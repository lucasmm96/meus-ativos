"""Testes dos parsers e do state tracking da ingestão de eventos.

Testes puros não precisam de banco. Testes marcados com `db` usam
DATABASE_URL e criam tickers sintéticos com teardown.
"""

import os
from datetime import date

import psycopg2
import psycopg2.extras
import pytest

from eventos_b3_mcp import (
    dedupe_eventos,
    parse_hoje_eventos,
    parse_trocas,
)
from eventos_b3_mcp_backfill import (
    QuotaExceeded,
    acquire_backfill_lock,
    is_fii_response,
    is_quota_error,
    lock_connection_url,
    mark_fii_pulados,
    mark_status,
    parse_eventos,
    reconnect,
    release_backfill_lock,
    select_pending_tickers,
)
from fixtures import with_test_data

DB = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL não configurada",
)


def test_dedupe_mesmo_fator_uma_linha():
    d = date(2020, 6, 15)
    rows = [
        ("SPLIT", "TST001", None, d, 4.0, "a", "dados-b3-mcp", None),
        ("SPLIT", "TST001", None, d, 4.0, "b", "dados-b3-mcp", None),
    ]
    assert len(dedupe_eventos(rows)) == 1


def test_dedupe_fator_conflitante_descarta(capsys):
    d = date(2020, 6, 15)
    rows = [
        ("SPLIT", "TST001", None, d, 4.0, "a", "dados-b3-mcp", None),
        ("SPLIT", "TST001", None, d, 5.0, "b", "dados-b3-mcp", None),
    ]
    assert dedupe_eventos(rows) == []
    assert "fatores conflitantes" in capsys.readouterr().out


def test_parse_hoje_mapeia_desdobramento():
    rows = parse_hoje_eventos(
        [
            {
                "tipo": "DESDOBRAMENTO",
                "ticker": "TST001",
                "data_ex": "2020-06-15",
                "fator": 4.0,
                "label": "Split 1:4",
            }
        ],
        lambda ticker, data_ex: date(2020, 6, 16),
        "https://exemplo/fonte",
    )
    assert rows == [
        (
            "SPLIT",
            "TST001",
            None,
            date(2020, 6, 16),
            4.0,
            "Split 1:4",
            "dados-b3-mcp",
            "https://exemplo/fonte",
        )
    ]


def test_parse_hoje_descarta_fator_invalido_e_flag(capsys):
    rows = parse_hoje_eventos(
        [
            {
                "tipo": "DESDOBRAMENTO",
                "ticker": "TST001",
                "data_ex": "2020-06-15",
                "fator": 0,
            },
            {
                "tipo": "DESDOBRAMENTO",
                "ticker": "TST002",
                "data_ex": "2020-06-15",
                "fator": 4.0,
                "flag": "divergente_do_preco",
            },
        ],
        lambda ticker, data_ex: date(2020, 6, 16),
    )
    assert rows == []
    out = capsys.readouterr().out
    assert "fator inválido" in out
    assert "flag divergente" in out


def test_parse_trocas_tolerante():
    rows = parse_trocas(
        [
            {"ticker": "OLD3", "ticker_novo": "NEW3", "data_ex": "2020-01-01"},
            {"ticker": "X"},
        ],
        lambda ticker, data_ex: date(2020, 1, 2),
    )
    assert len(rows) == 1
    assert rows[0][:3] == ("MUDANCA_TICKER", "OLD3", "NEW3")


def test_parse_eventos_usa_efeito_liquido_nao_fator_declarado():
    rows = parse_eventos(
        "TST001",
        [
            {
                "tipo": "DESDOBRAMENTO",
                "data_ex": "2020-06-15",
                "fator_declarado": 50.0,
                "efeito_liquido_do_dia": 2.0,
                "situacao": "ok",
            }
        ],
        lambda ticker, data_ex: date(2020, 6, 16),
    )
    assert len(rows) == 1
    assert rows[0][4] == 2.0


def test_parse_eventos_sem_proximo_pregao_descarta(capsys):
    rows = parse_eventos(
        "TST001",
        [
            {
                "tipo": "DESDOBRAMENTO",
                "data_ex": "2020-06-15",
                "efeito_liquido_do_dia": 2.0,
            }
        ],
        lambda ticker, data_ex: None,
    )
    assert rows == []
    assert "sem pregão" in capsys.readouterr().out


def test_parse_eventos_descarta_divergente_e_pre_2010():
    rows = parse_eventos(
        "TST001",
        [
            {
                "tipo": "DESDOBRAMENTO",
                "data_ex": "2020-06-15",
                "efeito_liquido_do_dia": 2.0,
                "situacao": "divergente_do_preco",
            },
            {
                "tipo": "DESDOBRAMENTO",
                "data_ex": "2009-12-01",
                "efeito_liquido_do_dia": 2.0,
            },
        ],
        lambda ticker, data_ex: date(2009, 12, 2)
        if data_ex == "2009-12-01"
        else date(2020, 6, 16),
    )
    assert rows == []


def test_fii_response():
    assert is_fii_response({"tente_assim": "fii"}) is True
    assert is_fii_response({"eventos": []}) is False


def test_quota_error_detectado():
    assert is_quota_error(
        {"erro": "limite diário de 200 consultas do plano grátis atingido"}
    )
    assert is_quota_error({"erro": "limite diario de 200 consultas"})
    assert not is_quota_error({"erro": "ticker desconhecido: ALUP3"})
    assert not is_quota_error({"eventos": []})


@DB
def test_select_pending_retoma_em_andamento_e_exclui_concluido():
    ticker = "TSTB01"
    with with_test_data(ticker, [], []) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            mark_status(cur, ticker, "em_andamento")
            conn.commit()
            assert select_pending_tickers(cur, only_ticker=ticker) == [ticker]

            mark_status(cur, ticker, "concluido")
            conn.commit()
            assert select_pending_tickers(cur, only_ticker=ticker) == []


@DB
def test_mark_fii_pulados():
    ticker = "TSTF11"
    with with_test_data(ticker, [], [], tipo="FII") as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            mark_fii_pulados(cur, only_ticker=ticker)
            conn.commit()
            cur.execute(
                "SELECT status FROM backfill_progress WHERE ticker = %s",
                (ticker,),
            )
            assert cur.fetchone()[0] == "pulado"


@DB
def test_advisory_lock_impede_segunda_execucao():
    url = lock_connection_url(os.environ["DATABASE_URL"])
    conn1 = psycopg2.connect(url)
    conn2 = psycopg2.connect(url)
    try:
        assert acquire_backfill_lock(conn1) is True
        assert acquire_backfill_lock(conn2) is False
        release_backfill_lock(conn1)
        assert acquire_backfill_lock(conn2) is True
        release_backfill_lock(conn2)
    finally:
        conn1.close()
        conn2.close()


@DB
def test_process_ticker_sem_eventos_conclui(monkeypatch):
    import eventos_b3_mcp_backfill as mod

    ticker = "TSTE01"
    with with_test_data(ticker, [], []) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            monkeypatch.setattr(mod, "_call_tool", lambda *a, **k: {"eventos": []})
            assert mod.process_ticker(conn, cur, ticker, "x") == ("concluido", 0)

            cur.execute(
                "SELECT status FROM backfill_progress WHERE ticker = %s",
                (ticker,),
            )
            assert cur.fetchone()[0] == "concluido"


@DB
def test_process_ticker_excecao_marca_falha(monkeypatch):
    import eventos_b3_mcp_backfill as mod

    def boom(*args, **kwargs):
        raise RuntimeError("boom")

    ticker = "TSTE02"
    with with_test_data(ticker, [], []) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            monkeypatch.setattr(
                mod,
                "_call_tool",
                lambda *a, **k: {
                    "eventos": [
                        {
                            "tipo": "DESDOBRAMENTO",
                            "data_ex": "2020-01-01",
                            "efeito_liquido_do_dia": 2.0,
                        }
                    ]
                },
            )
            monkeypatch.setattr(mod, "parse_eventos", boom)

            assert mod.process_ticker(conn, cur, ticker, "x") == ("falha", 0)
            cur.execute(
                "SELECT status, motivo_falha FROM backfill_progress WHERE ticker = %s",
                (ticker,),
            )
            status, motivo = cur.fetchone()
            assert status == "falha"
            assert "boom" in motivo


@DB
def test_process_ticker_aborta_na_quota(monkeypatch):
    import eventos_b3_mcp_backfill as mod

    ticker = "TSTQ01"
    with with_test_data(ticker, [], []) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            monkeypatch.setattr(
                mod,
                "_call_tool",
                lambda *a, **k: {
                    "erro": "limite diário de 200 consultas do plano grátis atingido"
                },
            )
            with pytest.raises(QuotaExceeded):
                mod.process_ticker(conn, cur, ticker, "x")

            cur.execute(
                "SELECT status FROM backfill_progress WHERE ticker = %s",
                (ticker,),
            )
            assert cur.fetchone()[0] == "falha"


@DB
def test_reconnect_apos_conexao_morta():
    url = lock_connection_url(os.environ["DATABASE_URL"])
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    conn.close()

    conn, cur = reconnect(url, conn, cur)
    try:
        cur.execute("SELECT 1")
        assert cur.fetchone()[0] == 1
    finally:
        cur.close()
        conn.close()


@DB
def test_insert_eventos_idempotente():
    from eventos_b3_mcp import insert_eventos

    ticker = "TSTI01"
    d = date(2020, 6, 16)
    row = (
        "SPLIT",
        ticker,
        None,
        d,
        4.0,
        "teste",
        "test",
        None,
    )
    with with_test_data(ticker, [], []) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            assert insert_eventos(cur, [row]) == 1
            conn.commit()
            assert insert_eventos(cur, [row]) == 0
            conn.commit()
            cur.execute(
                "SELECT count(*) FROM eventos_corporativos WHERE ticker = %s",
                (ticker,),
            )
            assert cur.fetchone()[0] == 1
