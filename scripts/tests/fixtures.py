import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras


def _connect():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def _delete_test_ticker(cur, ticker):
    cur.execute('DELETE FROM eventos_corporativos WHERE ticker = %s', (ticker,))
    cur.execute('DELETE FROM cotacoes WHERE "ativoTicker" = %s', (ticker,))
    cur.execute('DELETE FROM ativos WHERE ticker = %s', (ticker,))


@contextmanager
def with_test_data(ticker, cotacoes, eventos, tipo='ACAO'):
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ativos (ticker, nome, tipo, "tickerCotacao")
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (ticker) DO NOTHING
                """,
                (ticker, f'Teste {ticker}', tipo, ticker),
            )
            for data, preco in cotacoes:
                cur.execute(
                    """
                    INSERT INTO cotacoes ("ativoTicker", data, "precoFechamento")
                    VALUES (%s, %s, %s)
                    """,
                    (ticker, data, preco),
                )
            for evento in eventos:
                cur.execute(
                    """
                    INSERT INTO eventos_corporativos
                      (tipo, ticker, data_efetiva, fator_ajuste, fonte)
                    VALUES (%s, %s, %s, %s, 'test')
                    """,
                    (
                        evento['tipo'],
                        evento['ticker'],
                        evento['data_efetiva'],
                        evento['fator_ajuste'],
                    ),
                )
        conn.commit()
        yield conn
    finally:
        conn.rollback()
        with conn.cursor() as cur:
            _delete_test_ticker(cur, ticker)
        conn.commit()
        conn.close()


def query_view(ticker):
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM cotacoes_ajustadas
                WHERE "ativoTicker" = %s
                ORDER BY data
                """,
                (ticker,),
            )
            return cur.fetchall()
    finally:
        conn.close()
