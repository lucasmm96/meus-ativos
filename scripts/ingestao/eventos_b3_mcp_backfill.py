"""
Backfill histórico de eventos corporativos via dados-b3-mcp.

Fonte: https://dadosb3.com/mcp/ (MCP Streamable HTTP, JSON-RPC 2.0)
Ferramenta `eventos`: histórico por ticker. Exige DADOS_B3_API_KEY
(chave gratuita, 200 consultas/dia; reset no dia seguinte, relógio do
servidor). Apenas ações: FIIs são rejeitados pela ferramenta
(`tente_assim -> fii`).

Regras (Decisões 3 e 4):
  - Multiplicador = `efeito_liquido_do_dia`; descartar se null,
    não numérico, <= 0, ou `situacao == 'divergente_do_preco'`.
    `fator_declarado` NÃO é usado (formato percentual B3).
  - data_efetiva = próximo pregão COTAHIST após data_ex;
    sem pregão posterior, descarta com warning.
  - Deduplica (tipo, ticker, data_efetiva): mesmo `efeito_liquido_do_dia`
    (tolerância 1e-9) -> uma linha; valores diferentes -> warning +
    evento inteiro descartado (fonte contraditória).
  - Só data_efetiva >= 2010-01-01.
  - Upsert idempotente, fonte = 'dados-b3-mcp'.

State tracking (Decisão 3.1): tabela `backfill_progress`.
  - Ausência de linha = pendente.
  - `em_andamento` antes da consulta; `concluido` após sucesso;
    `falha` com motivo; `pulado` para FII.
  - Lote de até 200 ações por execução (limite diário da chave gratuita).
  - Retomável: segunda execução continua nos tickers sem `concluido`.

Concorrência (Decisão 3.2): advisory lock de sessão impede duas
execuções simultâneas do backfill. Script A (`hoje`) não usa lock.

Uso: DATABASE_URL=<neon> DADOS_B3_API_KEY=<chave> \
     python scripts/ingestao/eventos_b3_mcp_backfill.py

Quota: 200 consultas/dia. No estado atual (2026-11-09), o backfill exige
3 execuções em dias distintos: 200 + 200 + 9 consultas de quota.
FIIs (272) e tickers sem cobertura (5) são pulados sem consulta.
O upsert é idempotente; repetir tickers é seguro.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from datetime import date
from typing import Callable
from urllib.parse import urlsplit, urlunsplit

import psycopg2
from dotenv import load_dotenv

from eventos_b3_mcp import (
    MCPError,
    MCP_TO_ENUM,
    _call_tool,
    _initialize,
    dedupe_eventos,
    insert_eventos,
    proximo_pregao,
)

_CORTE = date(2010, 1, 1)
_LOCK_NAME = "eventos_b3_mcp_backfill"
_LIMITE_DIARIO = 200


class BackfillAbort(RuntimeError):
    """Falha de serviço/quota que deve interromper o lote inteiro."""


class QuotaExceeded(BackfillAbort):
    """Limite diário de consultas atingido (HTTP 429)."""


class DatabaseConnectionLost(BackfillAbort):
    """Conexão com o banco caiu no meio do lote; o chamador reconecta."""


_DB_CONN_ERRORS = (psycopg2.OperationalError, psycopg2.InterfaceError)


def reconnect(database_url: str, conn, cur):
    """Descarta a conexão morta e devolve (conn, cur) novos."""
    try:
        cur.close()
    except Exception:
        pass
    try:
        conn.close()
    except Exception:
        pass
    conn = psycopg2.connect(database_url)
    return conn, conn.cursor()


def is_quota_error(resp: dict) -> bool:
    """Quota esgotada vem como HTTP 200 + `erro` textual, não HTTP 429."""
    if not isinstance(resp, dict):
        return False
    texto = str(resp.get("erro") or "").lower()
    return (
        "limite diário" in texto
        or "limite diario" in texto
        or "plano grátis" in texto
        or "plano gratis" in texto
    )


def is_fii_response(resp: dict) -> bool:
    if not isinstance(resp, dict):
        return False
    tente = resp.get("tente_assim")
    return tente is not None and "fii" in str(tente).lower()


def _descricao(evento: dict):
    valor = evento.get("descricao") or evento.get("label")
    if valor is None:
        return None
    return valor if isinstance(valor, str) else str(valor)


def _fator_valido(valor):
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return None
    valor = float(valor)
    if not math.isfinite(valor) or valor <= 0:
        return None
    return valor


def parse_eventos(
    ticker: str,
    eventos: list[dict],
    resolver: Callable[[str, object], object],
) -> list[tuple]:
    rows: list[tuple] = []

    for ev in eventos or []:
        if not isinstance(ev, dict):
            print(f"WARN evento inválido: {ticker} {ev!r}")
            continue

        tipo_mcp = str(ev.get("tipo") or "").upper()
        tipo = MCP_TO_ENUM.get(tipo_mcp)
        if not tipo:
            print(f"WARN tipo desconhecido {tipo_mcp}: {ticker} {ev.get('data_ex')}")
            continue

        if (
            ev.get("situacao") == "divergente_do_preco"
            or ev.get("flag") == "divergente_do_preco"
        ):
            print(f"WARN divergente {ticker} {ev.get('data_ex')} {tipo_mcp}")
            continue

        fator = _fator_valido(ev.get("efeito_liquido_do_dia"))
        if fator is None:
            print(
                f"WARN fator inválido "
                f"{ev.get('efeito_liquido_do_dia')!r}: {ticker} {ev.get('data_ex')}"
            )
            continue

        data_ex = ev.get("data_ex")
        if not data_ex:
            print(f"WARN sem data_ex: {ticker} {tipo_mcp}")
            continue

        data_efetiva = resolver(ticker, data_ex)
        if not data_efetiva:
            print(f"WARN sem pregão após {data_ex} para {ticker}: descartado")
            continue

        if data_efetiva < _CORTE:
            continue

        rows.append(
            (
                tipo,
                ticker,
                None,
                data_efetiva,
                fator,
                _descricao(ev),
                "dados-b3-mcp",
                ev.get("fonte_url"),
            )
        )

    return dedupe_eventos(rows)


def lock_connection_url(database_url: str) -> str:
    """Remove o sufixo `-pooler` do host.

    Advisory locks são de sessão e não são confiáveis através do pooler
    (PgBouncer em modo transaction). O backfill usa uma conexão direta
    dedicada só para o lock.
    """
    parts = urlsplit(database_url)
    host = parts.hostname or ""
    if "-pooler" not in host:
        return database_url
    direct_host = host.replace("-pooler", "", 1)
    netloc = parts.netloc.replace(host, direct_host, 1)
    return urlunsplit(
        (parts.scheme, netloc, parts.path, parts.query, parts.fragment)
    )


def acquire_backfill_lock(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_try_advisory_lock(hashtextextended(%s, 0))",
            (_LOCK_NAME,),
        )
        acquired = bool(cur.fetchone()[0])
    conn.commit()
    return acquired


def release_backfill_lock(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_advisory_unlock(hashtextextended(%s, 0))",
            (_LOCK_NAME,),
        )
    conn.commit()


def mark_status(cur, ticker: str, status: str, motivo: str | None = None) -> None:
    cur.execute(
        """
        INSERT INTO backfill_progress
          (ticker, status, ultima_tentativa, motivo_falha)
        VALUES (%s, %s, now(), %s)
        ON CONFLICT (ticker) DO UPDATE SET
          status = EXCLUDED.status,
          ultima_tentativa = EXCLUDED.ultima_tentativa,
          motivo_falha = EXCLUDED.motivo_falha
        """,
        (ticker, status, motivo),
    )


def mark_fii_pulados(cur, only_ticker: str | None = None) -> int:
    filtro = ""
    params: list[object] = []
    if only_ticker:
        filtro = "AND ticker = %s"
        params.append(only_ticker)

    cur.execute(
        f"""
        INSERT INTO backfill_progress (ticker, status, ultima_tentativa)
        SELECT ticker, 'pulado', now()
        FROM ativos
        WHERE tipo = 'FII'
          {filtro}
        ON CONFLICT (ticker) DO UPDATE SET
          status = 'pulado',
          ultima_tentativa = now(),
          motivo_falha = NULL
        WHERE backfill_progress.status IS DISTINCT FROM 'pulado'
        """,
        params,
    )
    return cur.rowcount


def select_pending_tickers(
    cur, limit: int = _LIMITE_DIARIO, only_ticker: str | None = None
) -> list[str]:
    params: list[object] = []
    filtro = ""
    if only_ticker:
        filtro = "AND a.ticker = %s"
        params.append(only_ticker)

    params.append(limit)
    cur.execute(
        f"""
        SELECT a.ticker
        FROM ativos a
        LEFT JOIN backfill_progress bp ON bp.ticker = a.ticker
        WHERE a.tipo = 'ACAO'
          AND (
            bp.status IS NULL
            OR bp.status IN ('pendente', 'falha', 'em_andamento')
          )
          {filtro}
        ORDER BY a.ticker
        LIMIT %s
        """,
        params,
    )
    return [row[0] for row in cur.fetchall()]


def _safe_mark(conn, cur, ticker: str, status: str, motivo: str | None = None) -> None:
    try:
        mark_status(cur, ticker, status, motivo)
        conn.commit()
    except _DB_CONN_ERRORS as exc:
        raise DatabaseConnectionLost(f"mark {status}: {exc}") from exc


def process_ticker(conn, cur, ticker: str, chave: str) -> tuple[str, int]:
    """Processa um ticker. Retorna (status, eventos_inseridos)."""
    try:
        mark_status(cur, ticker, "em_andamento")
        conn.commit()
    except _DB_CONN_ERRORS as exc:
        raise DatabaseConnectionLost(f"mark em_andamento: {exc}") from exc

    try:
        resp = _call_tool("eventos", {"ticker": ticker, "chave_api": chave})
    except MCPError as exc:
        try:
            conn.rollback()
            mark_status(cur, ticker, "falha", f"MCP: {exc}")
            conn.commit()
        except _DB_CONN_ERRORS as db_exc:
            raise DatabaseConnectionLost(
                f"registro de falha MCP: {db_exc}"
            ) from db_exc
        if exc.status_code == 429:
            raise QuotaExceeded(str(exc)) from exc
        if exc.status_code is not None and exc.status_code >= 500:
            raise BackfillAbort(str(exc)) from exc
        return "falha", 0

    if is_fii_response(resp):
        _safe_mark(conn, cur, ticker, "pulado", "fii")
        print(f"{ticker}: pulado (fii)")
        return "pulado", 0

    if resp.get("erro"):
        erro = str(resp["erro"])
        _safe_mark(conn, cur, ticker, "falha", erro)
        print(f"{ticker}: falha ({erro})")
        if is_quota_error(resp):
            raise QuotaExceeded(erro)
        return "falha", 0

    eventos = resp.get("eventos")
    if not isinstance(eventos, list):
        _safe_mark(conn, cur, ticker, "falha", "resposta sem lista de eventos")
        print(f"{ticker}: falha (resposta sem lista de eventos)")
        return "falha", 0

    try:
        rows = parse_eventos(
            ticker,
            eventos,
            lambda t, d: proximo_pregao(cur, t, d),
        )
        inseridos = insert_eventos(cur, rows)
        mark_status(cur, ticker, "concluido")
        conn.commit()
        print(f"{ticker}: {len(rows)} eventos processados, {inseridos} inseridos")
        return "concluido", inseridos
    except Exception as exc:
        try:
            conn.rollback()
        except _DB_CONN_ERRORS as db_exc:
            raise DatabaseConnectionLost(f"rollback: {db_exc}") from db_exc
        _safe_mark(conn, cur, ticker, "falha", f"parser/insert: {exc}")
        print(f"{ticker}: falha ({exc})")
        return "falha", 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit",
        type=int,
        default=_LIMITE_DIARIO,
        help="máximo de ações processadas nesta execução (1..200)",
    )
    args = parser.parse_args(argv)
    limit = max(1, min(args.limit, _LIMITE_DIARIO))

    load_dotenv()
    load_dotenv(".env.local")

    database_url = os.environ.get("DATABASE_URL")
    chave = os.environ.get("DADOS_B3_API_KEY")
    if not database_url:
        print("ERRO: DATABASE_URL não definida", file=sys.stderr)
        return 1
    if not chave:
        print("ERRO: DADOS_B3_API_KEY não definida", file=sys.stderr)
        return 1

    _initialize()

    lock_conn = psycopg2.connect(lock_connection_url(database_url))
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    lock_adquirido = False
    try:
        lock_adquirido = acquire_backfill_lock(lock_conn)
        if not lock_adquirido:
            print(
                "ERRO: outra execução do backfill está em andamento "
                "(advisory lock não adquirido)",
                file=sys.stderr,
            )
            return 2

        fiis = mark_fii_pulados(cur)
        conn.commit()
        tickers = select_pending_tickers(cur, limit)

        print(
            f"{fiis} FIIs marcados como pulados; "
            f"{len(tickers)} ações a processar (limite {limit})"
        )
        if not tickers:
            print("Nada pendente")
            return 0

        inseridos = pulados = falhas = 0
        try:
            for ticker in tickers:
                tentativas = 0
                while True:
                    try:
                        status, n = process_ticker(conn, cur, ticker, chave)
                        break
                    except DatabaseConnectionLost as exc:
                        tentativas += 1
                        if tentativas >= 3:
                            raise BackfillAbort(
                                f"conexão perdida {tentativas}x em {ticker}: {exc}"
                            ) from exc
                        print(
                            f"WARN conexão com o banco caiu em {ticker}: "
                            f"{exc} — reconectando"
                        )
                        try:
                            conn, cur = reconnect(database_url, conn, cur)
                        except psycopg2.Error as db_exc:
                            raise BackfillAbort(
                                f"reconexão falhou: {db_exc}"
                            ) from db_exc

                if status == "concluido":
                    inseridos += n
                elif status == "pulado":
                    pulados += 1
                else:
                    falhas += 1
        except QuotaExceeded as exc:
            print(f"ERRO: quota diária atingida — {exc}", file=sys.stderr)
            return 1
        except BackfillAbort as exc:
            print(f"ERRO: lote interrompido — {exc}", file=sys.stderr)
            return 1

        print(
            f"Concluído: {inseridos} eventos inseridos, "
            f"{pulados} pulados, {falhas} falhas"
        )
        return 1 if falhas else 0
    finally:
        if lock_adquirido:
            try:
                release_backfill_lock(lock_conn)
            except Exception:
                pass
        try:
            cur.close()
        except Exception:
            pass
        lock_conn.close()
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
