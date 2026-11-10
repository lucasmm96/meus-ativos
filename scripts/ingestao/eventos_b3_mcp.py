"""
Ingere eventos corporativos via dados-b3-mcp.

Fonte REAL confirmada em 2026-11-09: https://dadosb3.com/mcp/
Protocolo: MCP Streamable HTTP (JSON-RPC 2.0), NÃO REST.
A ferramenta `hoje` é gratuita e sem chave (janela de 30 dias).
A ferramenta `eventos` (histórico por ticker) exige chave gratuita
(200 consultas/dia, reset quando o dia vira no relógio do servidor) —
usada pelo backfill `eventos_b3_mcp_backfill.py`.

Regras de data (Decisão 3):
  data_efetiva = próximo pregão do ticker no COTAHIST APÓS data_ex.
  Se não houver pregão posterior, o evento é descartado com warning.

Regras de taxonomia (Decisão 4):
  DESDOBRAMENTO -> SPLIT; demais via MCP_TO_ENUM.
  Evento com fator null, não numérico, <= 0, ou flag 'divergente_do_preco'
  é descartado.
  Duplicatas (mesmo tipo/ticker/data_efetiva): mesmo fator -> uma linha;
  fatores conflitantes -> warning + evento inteiro descartado.

Uso: DATABASE_URL=<neon> python scripts/ingestao/eventos_b3_mcp.py
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from typing import Callable, Iterable

import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import execute_values

_MCP_URL = "https://dadosb3.com/mcp/"
_PROTOCOL_VERSION = "2025-03-26"
_SESSION_ID: str | None = None
_TOLERANCIA_FATOR = 1e-9

MCP_TO_ENUM = {
    "DESDOBRAMENTO": "SPLIT",
    "GRUPAMENTO": "GRUPAMENTO",
    "BONIFICACAO": "BONIFICACAO",
    "SUBSCRICAO": "SUBSCRICAO",
    "CISAO": "CISAO",
    "FUSAO": "FUSAO",
    "INCORPORACAO": "INCORPORACAO",
    "MUDANCA_TICKER": "MUDANCA_TICKER",
}


class MCPError(RuntimeError):
    """Erro de transporte ou de resposta JSON-RPC do dados-b3-mcp."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _parse_rpc_body(response: requests.Response) -> dict:
    text = response.text.strip()
    if not text:
        return {}

    ctype = response.headers.get("Content-Type", "")
    if (
        "text/event-stream" in ctype
        or text.startswith("event:")
        or text.startswith("data:")
    ):
        payloads = []
        for line in text.splitlines():
            if not line.startswith("data:"):
                continue
            chunk = line[5:].strip()
            if not chunk or chunk == "[DONE]":
                continue
            try:
                payloads.append(json.loads(chunk))
            except ValueError as exc:
                raise MCPError(f"SSE inválido: {chunk[:200]!r}") from exc
        if not payloads:
            raise MCPError("Resposta SSE sem data payload")
        return payloads[-1]

    try:
        return response.json()
    except ValueError as exc:
        raise MCPError(
            f"Resposta não-JSON (HTTP {response.status_code}): {text[:200]!r}",
            response.status_code,
        ) from exc


def _rpc(payload: dict) -> dict:
    global _SESSION_ID

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if _SESSION_ID:
        headers["Mcp-Session-Id"] = _SESSION_ID

    try:
        response = requests.post(
            _MCP_URL,
            headers=headers,
            json=payload,
            timeout=60,
        )
    except requests.RequestException as exc:
        raise MCPError(f"Falha de rede no MCP: {exc}") from exc

    if response.status_code >= 400:
        raise MCPError(
            f"HTTP {response.status_code}: {response.text[:300]!r}",
            response.status_code,
        )

    session_id = response.headers.get("Mcp-Session-Id")
    if session_id:
        _SESSION_ID = session_id

    return _parse_rpc_body(response)


def _initialize() -> None:
    global _SESSION_ID
    _SESSION_ID = None
    _rpc(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": _PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "meus-ativos", "version": "1.0"},
            },
        }
    )
    _rpc({"jsonrpc": "2.0", "method": "notifications/initialized"})


def _call_tool(name: str, arguments: dict) -> dict:
    response = _rpc(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }
    )

    if "error" in response:
        raise MCPError(f"Erro JSON-RPC em {name}: {response['error']}")

    result = response.get("result") or {}
    text = None
    for item in result.get("content") or []:
        if item.get("type") == "text" and "text" in item:
            text = item["text"]
            break

    if text is None:
        structured = result.get("structuredContent")
        if isinstance(structured, dict):
            return structured
        raise MCPError(f"Resposta de {name} sem content textual")

    try:
        parsed = json.loads(text)
    except ValueError as exc:
        raise MCPError(f"Content de {name} não é JSON: {text[:200]!r}") from exc

    if not isinstance(parsed, dict):
        raise MCPError(f"Content de {name} não é objeto JSON")
    return parsed


def proximo_pregao(cur, ticker: str, data_ex):
    cur.execute(
        """
        SELECT data FROM cotacoes
        WHERE "ativoTicker" = %s AND data > %s
        ORDER BY data ASC LIMIT 1
        """,
        (ticker, data_ex),
    )
    row = cur.fetchone()
    return row[0] if row else None


def _fator_valido(valor):
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return None
    valor = float(valor)
    if not math.isfinite(valor) or valor <= 0:
        return None
    return valor


def _descricao(evento: dict):
    valor = evento.get("label") or evento.get("descricao")
    if valor is None:
        return None
    return valor if isinstance(valor, str) else str(valor)


def dedupe_eventos(rows: list[tuple]) -> list[tuple]:
    """
    Colapsa duplicatas por (tipo, ticker, data_efetiva).
    Mesmo fator (tolerância 1e-9) -> uma linha. Fatores diferentes ->
    warning + evento inteiro descartado (D4): fonte contraditória não
    permite confiar no fator.
    """
    por_chave: dict[tuple, tuple] = {}
    conflitos: set[tuple] = set()

    for row in rows:
        chave = (row[0], row[1], row[3])
        if chave in conflitos:
            continue
        anterior = por_chave.get(chave)
        if anterior is None:
            por_chave[chave] = row
            continue

        a, b = anterior[4], row[4]
        if a is None or b is None:
            divergem = (a != b) or (anterior[2] != row[2])
        else:
            divergem = (
                not math.isfinite(float(a))
                or not math.isfinite(float(b))
                or abs(float(a) - float(b)) > _TOLERANCIA_FATOR
            )

        if divergem:
            print(
                f"WARN fatores conflitantes {row[1]} {row[3]} {row[0]}: "
                f"{a} vs {b} — evento descartado"
            )
            del por_chave[chave]
            conflitos.add(chave)

    return list(por_chave.values())


Resolvedor = Callable[[str, object], object]


def parse_hoje_eventos(
    itens: Iterable[dict], resolver: Resolvedor, fonte_url: str | None = None
) -> list[tuple]:
    rows: list[tuple] = []

    for ev in itens or []:
        if not isinstance(ev, dict):
            print(f"WARN item de evento inválido: {ev!r}")
            continue

        tipo_mcp = str(ev.get("tipo") or "").upper()
        tipo = MCP_TO_ENUM.get(tipo_mcp)
        if not tipo:
            print(f"WARN tipo desconhecido {tipo_mcp}: {ev}")
            continue

        ticker = (ev.get("ticker") or "").strip()
        data_ex = ev.get("data_ex")
        if not ticker or not data_ex:
            print(f"WARN evento sem ticker/data_ex: {ev}")
            continue

        if (
            ev.get("flag") == "divergente_do_preco"
            or ev.get("situacao") == "divergente_do_preco"
        ):
            print(f"WARN descartado {ticker} {data_ex} {tipo_mcp}: flag divergente")
            continue

        fator = _fator_valido(ev.get("fator"))
        if fator is None:
            print(f"WARN descartado {ticker} {data_ex} {tipo_mcp}: fator inválido")
            continue

        data_efetiva = resolver(ticker, data_ex)
        if not data_efetiva:
            print(f"WARN sem pregão após {data_ex} para {ticker}: descartado")
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
                fonte_url,
            )
        )

    return rows


def parse_trocas(
    itens: Iterable[dict], resolver: Resolvedor, fonte_url: str | None = None
) -> list[tuple]:
    rows: list[tuple] = []

    for tr in itens or []:
        if not isinstance(tr, dict):
            print(f"WARN troca inválida: {tr!r}")
            continue
        ticker = tr.get("ticker") or tr.get("ticker_antigo")
        relacionado = tr.get("ticker_novo") or tr.get("ticker_relacionado")
        data_ex = tr.get("data_ex") or tr.get("data")
        if not (ticker and relacionado and data_ex):
            print(f"WARN troca não reconhecida: {tr}")
            continue

        data_efetiva = resolver(ticker, data_ex)
        if not data_efetiva:
            print(f"WARN sem pregão após {data_ex} para {ticker}: troca descartada")
            continue

        rows.append(
            (
                "MUDANCA_TICKER",
                ticker,
                relacionado,
                data_efetiva,
                None,
                None,
                "dados-b3-mcp",
                fonte_url,
            )
        )

    return rows


def build_hoje_rows(hoje: dict, cur) -> list[tuple]:
    if not isinstance(hoje, dict):
        raise MCPError("Resposta de `hoje` não é objeto JSON")
    if hoje.get("erro"):
        raise MCPError(f"Erro em `hoje`: {hoje['erro']}")

    metadados = hoje.get("metadados") or {}
    fonte_url = metadados.get("fonte_url") if isinstance(metadados, dict) else None

    eventos = hoje.get("eventos") or {}
    itens = eventos.get("itens", []) if isinstance(eventos, dict) else eventos

    trocas = hoje.get("trocas") or {}
    itens_trocas = trocas.get("itens", []) if isinstance(trocas, dict) else trocas

    resolver = lambda ticker, data_ex: proximo_pregao(cur, ticker, data_ex)
    rows = parse_hoje_eventos(itens, resolver, fonte_url)
    rows += parse_trocas(itens_trocas, resolver, fonte_url)
    return dedupe_eventos(rows)


def insert_eventos(cur, rows: list[tuple]) -> int:
    if not rows:
        return 0

    inserted = execute_values(
        cur,
        """
        INSERT INTO eventos_corporativos
          (tipo, ticker, ticker_relacionado, data_efetiva, fator_ajuste,
           descricao, fonte, fonte_url)
        VALUES %s
        ON CONFLICT (tipo, ticker, data_efetiva) DO NOTHING
        RETURNING id
        """,
        rows,
        template=(
            "(%s::tipo_evento_corporativo, %s, %s, %s, %s, %s, %s, %s)"
        ),
        fetch=True,
    )
    return len(inserted or [])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)

    load_dotenv()
    load_dotenv(".env.local")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERRO: DATABASE_URL não definida", file=sys.stderr)
        return 1

    _initialize()
    hoje = _call_tool("hoje", {})

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            rows = build_hoje_rows(hoje, cur)
            if not rows:
                print("Nenhum evento novo")
                return 0
            inseridos = insert_eventos(cur, rows)
        conn.commit()
        print(f"Processados {len(rows)} eventos; inseridos {inseridos}")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
