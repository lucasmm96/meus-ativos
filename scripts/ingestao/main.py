"""
COTAHIST ingestion script.

Downloads B3's daily COTAHIST file directly (or annual with BACKFILL=true),
populates the `ativos` catalog with all spot-market ações and FIIs, then
upserts closing prices into the `cotacoes` table.

Usage:
  DATABASE_URL=<neon-connection-string> python main.py
  DATABASE_URL=<neon-connection-string> BACKFILL=true python main.py
"""

import io
import os
import sys
import zipfile
from datetime import datetime, timedelta, timezone

import psycopg2
import requests
from dotenv import load_dotenv


_CODBDI_ACAO = 2
_CODBDI_FII = 12
_TPMERC_VISTA = 10

_B3_BASE = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist"


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------

def _download(url: str) -> bytes:
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.content


def _parse(content: bytes) -> list[dict]:
    """Parse COTAHIST fixed-width text (latin-1). Returns type-02 records."""
    records = []
    for line in content.decode("latin-1").splitlines():
        # Type-02 data records are exactly 245 chars; skip header/trailer.
        if len(line) < 245 or line[0:2] != "02":
            continue
        try:
            records.append({
                "CODBDI": int(line[10:12]),
                "TPMERC": int(line[24:27]),
                "CODNEG": line[12:24].strip(),
                "NOMRES": line[27:39].strip(),
                "DATPRE": datetime.strptime(line[2:10], "%Y%m%d").date(),
                # Price is stored as integer with 2 implied decimal places.
                "PREULT": int(line[108:121]) / 100,
            })
        except (ValueError, IndexError):
            continue
    return records


def download_daily() -> list[dict]:
    """Download the most recent available daily COTAHIST file (last 5 days)."""
    today = datetime.now(timezone.utc).date()
    for delta in range(1, 6):
        d = today - timedelta(days=delta)
        fname = f"COTD{d.strftime('%d%m%Y')}"
        url = f"{_B3_BASE}/{fname}.ZIP"
        try:
            data = _download(url)
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                with z.open(f"{fname}.TXT") as f:
                    records = _parse(f.read())
            print(f"Downloaded daily file for {d} ({len(records)} records)")
            return records
        except (requests.HTTPError, KeyError, zipfile.BadZipFile):
            continue
    raise RuntimeError("No COTAHIST daily file found in the last 5 days")


def download_annual() -> list[dict]:
    """Download the annual COTAHIST file for the current year."""
    year = datetime.now(timezone.utc).year
    fname = f"COTAHIST_A{year}"
    url = f"{_B3_BASE}/{fname}.ZIP"
    data = _download(url)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        with z.open(f"{fname}.TXT") as f:
            records = _parse(f.read())
    print(f"Downloaded annual file for {year} ({len(records)} records)")
    return records


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

def upsert_ativos(cur, records: list[dict]) -> int:
    """Upsert the ativos catalog. Returns number of rows processed."""
    seen: dict[str, dict] = {}
    for r in records:
        if (
            r["TPMERC"] == _TPMERC_VISTA
            and r["CODBDI"] in (_CODBDI_ACAO, _CODBDI_FII)
            and not r["CODNEG"].endswith("F")
            and r["CODNEG"] not in seen
        ):
            seen[r["CODNEG"]] = r

    print(f"{len(seen)} ativo(s) found in COTAHIST")

    for r in seen.values():
        tipo = "FII" if r["CODBDI"] == _CODBDI_FII else "ACAO"
        cur.execute(
            """
            INSERT INTO ativos (ticker, nome, tipo, "tickerCotacao")
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (ticker) DO NOTHING
            """,
            (r["CODNEG"], r["NOMRES"], tipo, r["CODNEG"]),
        )
    return len(seen)


def upsert_cotacoes(cur, records: list[dict], valid_tickers: set[str]) -> int:
    """Upsert cotacoes for tickers in the catalog. Returns rows inserted."""
    inserted = 0
    for r in records:
        if (
            r["TPMERC"] != _TPMERC_VISTA
            or r["CODBDI"] not in (_CODBDI_ACAO, _CODBDI_FII)
            or r["CODNEG"] not in valid_tickers
        ):
            continue
        cur.execute(
            """
            INSERT INTO cotacoes ("ativoTicker", data, "precoFechamento")
            VALUES (%s, %s, %s)
            ON CONFLICT ("ativoTicker", data) DO NOTHING
            """,
            (r["CODNEG"], r["DATPRE"], f"{r['PREULT']:.6f}"),
        )
        if cur.rowcount > 0:
            inserted += 1
    return inserted


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    load_dotenv()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable is not set")
        sys.exit(1)

    backfill = os.environ.get("BACKFILL", "false").lower() == "true"

    print("Downloading COTAHIST...")
    try:
        records = download_annual() if backfill else download_daily()
    except Exception as exc:
        print(f"Error downloading COTAHIST: {exc}")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    try:
        cur = conn.cursor()

        ativos_count = upsert_ativos(cur, records)
        print(f"Processed {ativos_count} ativo(s) for catalog")

        cur.execute('SELECT "tickerCotacao" FROM ativos')
        valid_tickers: set[str] = {row[0] for row in cur.fetchall()}
        print(f"{len(valid_tickers)} valid ticker(s) for price lookup")

        inserted = upsert_cotacoes(cur, records, valid_tickers)
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
