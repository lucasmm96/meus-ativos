"""
COTAHIST ingestion script.

Downloads B3's daily (or annual, when BACKFILL=true) price file, filters it
to the tickers registered in the database, and upserts closing prices into
the `cotacoes` table.

Usage:
  DATABASE_URL=<neon-connection-string> python main.py
  DATABASE_URL=<neon-connection-string> BACKFILL=true python main.py
"""

import os
import sys

import psycopg2
from dotenv import load_dotenv
import b3quant


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

        # 1. Read valid tickers from the ativos catalog.
        cur.execute('SELECT "tickerCotacao" FROM ativos')
        valid_tickers: set[str] = {row[0] for row in cur.fetchall()}
        print(f"{len(valid_tickers)} valid ticker(s) loaded from database")

        # 2. Download COTAHIST — annual file for back-fill, daily otherwise.
        backfill = os.environ.get("BACKFILL", "false").lower() == "true"
        try:
            if backfill:
                df = b3quant.cotahist.download(mode="annual")
            else:
                df = b3quant.cotahist.download(mode="daily")
        except Exception as exc:
            print(f"Error downloading COTAHIST: {exc}")
            sys.exit(1)

        # 3. Filter: keep only registered tickers on the spot market (CODBDI == 12).
        df_filtered = df[
            df["CODNEG"].isin(valid_tickers) & (df["CODBDI"] == 12)
        ]
        print(f"{len(df_filtered)} row(s) match after filtering")

        # 4. Upsert each row — skip duplicates silently.
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
        print(f"Inserted {inserted} row(s)")
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
