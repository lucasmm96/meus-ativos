"""
COTAHIST ingestion script.

Downloads B3's daily (or annual, when BACKFILL=true) price file, populates
the `ativos` catalog with all spot-market ações and FIIs, then upserts
closing prices into the `cotacoes` table.

Usage:
  DATABASE_URL=<neon-connection-string> python main.py
  DATABASE_URL=<neon-connection-string> BACKFILL=true python main.py
"""

import os
import sys

import psycopg2
from dotenv import load_dotenv
import b3quant


_CODBDI_ACAO = 2
_CODBDI_FII = 12
_TPMERC_VISTA = 10


def upsert_ativos(cur, df) -> int:
    """Upsert the ativos catalog from COTAHIST. Returns number of rows processed."""
    # Spot market, ações and FIIs only, exclude fractional-share tickers (suffix F).
    mask = (
        (df["TPMERC"] == _TPMERC_VISTA)
        & (df["CODBDI"].isin([_CODBDI_ACAO, _CODBDI_FII]))
        & (~df["CODNEG"].str.endswith("F"))
    )
    sub = df[mask].drop_duplicates(subset=["CODNEG"])
    print(f"{len(sub)} ativo(s) found in COTAHIST")

    upserted = 0
    for _, row in sub.iterrows():
        tipo = "FII" if row["CODBDI"] == _CODBDI_FII else "ACAO"
        ticker = row["CODNEG"]
        cur.execute(
            """
            INSERT INTO ativos (ticker, nome, tipo, "tickerCotacao")
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (ticker) DO NOTHING
            """,
            (ticker, row["NOMRES"].strip(), tipo, ticker),
        )
        upserted += 1
    return upserted


def main() -> None:
    # Load .env for local development; a no-op in CI where vars are injected.
    load_dotenv()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable is not set")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    try:
        cur = conn.cursor()

        # 1. Download COTAHIST — annual file for back-fill, daily otherwise.
        backfill = os.environ.get("BACKFILL", "false").lower() == "true"
        try:
            if backfill:
                df = b3quant.cotahist.download(mode="annual")
            else:
                df = b3quant.cotahist.download(mode="daily")
        except Exception as exc:
            print(f"Error downloading COTAHIST: {exc}")
            sys.exit(1)

        # 2. Upsert ativos catalog from COTAHIST.
        ativos_count = upsert_ativos(cur, df)
        print(f"Processed {ativos_count} ativo(s) for catalog")

        # 3. Read valid tickers from updated catalog.
        cur.execute('SELECT "tickerCotacao" FROM ativos')
        valid_tickers: set[str] = {row[0] for row in cur.fetchall()}
        print(f"{len(valid_tickers)} valid ticker(s) for price lookup")

        # 4. Filter COTAHIST: spot market, ações+FIIs, matching catalog.
        df_filtered = df[
            (df["TPMERC"] == _TPMERC_VISTA)
            & (df["CODBDI"].isin([_CODBDI_ACAO, _CODBDI_FII]))
            & (df["CODNEG"].isin(valid_tickers))
        ]
        print(f"{len(df_filtered)} price row(s) match after filtering")

        # 5. Upsert cotacoes — skip duplicates silently.
        inserted = 0
        for _, row in df_filtered.iterrows():
            cur.execute(
                """
                INSERT INTO cotacoes ("ativoTicker", data, "precoFechamento")
                VALUES (%s, %s, %s)
                ON CONFLICT ("ativoTicker", data) DO NOTHING
                """,
                (row["CODNEG"], row["DATPRE"], f"{row['PREULT']:.6f}"),
            )
            if cur.rowcount > 0:
                inserted += 1

        conn.commit()
        print(f"Inserted {inserted} price row(s)")
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
