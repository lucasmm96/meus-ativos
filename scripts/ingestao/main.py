"""
COTAHIST ingestion script.

Modes (via env vars):
  default          — daily: most recent daily file, upserts ativos + cotacoes
  BACKFILL=true    — single annual file (current year)
  BACKFILL_ALL=true — full historical backfill:
                       annual 1986–prev_year
                       + monthly Jan–prev_month of current year
                       + daily from day 1 of current month up to 2 days ago

Usage:
  DATABASE_URL=<neon-connection-string> python main.py
  DATABASE_URL=<neon-connection-string> BACKFILL=true python main.py
  DATABASE_URL=<neon-connection-string> BACKFILL_ALL=true python main.py
"""

import io
import os
import sys
import zipfile
from datetime import datetime, timedelta, timezone

import psycopg2
from psycopg2.extras import execute_values
import requests
from dotenv import load_dotenv


_CODBDI_ACAO = 2
_CODBDI_FII = 12
_TPMERC_VISTA = 10
_BATCH_SIZE = 5000

_B3_BASE = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist"


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------

def _download(url: str) -> bytes:
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.content


def _open_zip_txt(data: bytes, fname: str):
    """Return the open file object for {fname}.TXT inside a ZIP payload."""
    z = zipfile.ZipFile(io.BytesIO(data))
    return z, z.open(f"{fname}.TXT")


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _parse(content: bytes) -> list[dict]:
    """Parse full COTAHIST content into a list of dicts (for small daily files)."""
    records = []
    for line in content.decode("latin-1").splitlines():
        if len(line) < 245 or line[0:2] != "01":
            continue
        try:
            records.append({
                "CODBDI": int(line[10:12]),
                "TPMERC": int(line[24:27]),
                "CODNEG": line[12:24].strip(),
                "NOMRES": line[27:39].strip(),
                "DATPRE": datetime.strptime(line[2:10], "%Y%m%d").date(),
                "PREULT": int(line[108:121]) / 100,
            })
        except (ValueError, IndexError):
            continue
    return records


def _stream_cotacoes(file_obj, valid_tickers: set[str]):
    """Generator: stream-parse a COTAHIST file and yield (ticker, date, price) tuples."""
    for line in io.TextIOWrapper(file_obj, encoding="latin-1"):
        if len(line) < 245 or line[0:2] != "01":
            continue
        try:
            codbdi = int(line[10:12])
            tpmerc = int(line[24:27])
        except ValueError:
            continue
        if tpmerc != _TPMERC_VISTA or codbdi not in (_CODBDI_ACAO, _CODBDI_FII):
            continue
        codneg = line[12:24].strip()
        if codneg not in valid_tickers:
            continue
        try:
            datpre = datetime.strptime(line[2:10], "%Y%m%d").date()
            preult = int(line[108:121]) / 100
        except (ValueError, IndexError):
            continue
        yield (codneg, datpre, f"{preult:.6f}")


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def upsert_ativos(cur, records: list[dict]) -> int:
    """Upsert the ativos catalog from COTAHIST. Returns rows processed."""
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


def _batch_upsert_cotacoes(cur, rows_gen) -> int:
    """Batch-upsert cotacoes from a generator. Returns rows processed."""
    total = 0
    batch: list[tuple] = []
    for row in rows_gen:
        batch.append(row)
        if len(batch) >= _BATCH_SIZE:
            execute_values(
                cur,
                """
                INSERT INTO cotacoes ("ativoTicker", data, "precoFechamento")
                VALUES %s ON CONFLICT ("ativoTicker", data) DO NOTHING
                """,
                batch,
            )
            total += len(batch)
            batch = []
    if batch:
        execute_values(
            cur,
            """
            INSERT INTO cotacoes ("ativoTicker", data, "precoFechamento")
            VALUES %s ON CONFLICT ("ativoTicker", data) DO NOTHING
            """,
            batch,
        )
        total += len(batch)
    return total


def upsert_cotacoes(cur, records: list[dict], valid_tickers: set[str]) -> int:
    """Upsert cotacoes from a list of dicts. Returns rows processed."""
    rows = [
        (r["CODNEG"], r["DATPRE"], f"{r['PREULT']:.6f}")
        for r in records
        if (
            r["TPMERC"] == _TPMERC_VISTA
            and r["CODBDI"] in (_CODBDI_ACAO, _CODBDI_FII)
            and r["CODNEG"] in valid_tickers
        )
    ]
    return _batch_upsert_cotacoes(cur, iter(rows))


# ---------------------------------------------------------------------------
# Download modes
# ---------------------------------------------------------------------------

def download_daily() -> list[dict]:
    """Download the most recent available daily COTAHIST file (tries last 5 days)."""
    today = datetime.now(timezone.utc).date()
    for delta in range(1, 6):
        d = today - timedelta(days=delta)
        fname = f"COTAHIST_D{d.strftime('%d%m%Y')}"
        url = f"{_B3_BASE}/{fname}.ZIP"
        try:
            data = _download(url)
            z, f = _open_zip_txt(data, fname)
            with z, f:
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
    z, f = _open_zip_txt(data, fname)
    with z, f:
        records = _parse(f.read())
    print(f"Downloaded annual file for {year} ({len(records)} records)")
    return records


# ---------------------------------------------------------------------------
# Full historical backfill
# ---------------------------------------------------------------------------

def run_backfill_all(database_url: str) -> None:
    """
    Download and upsert all available COTAHIST history:
      - Annual files:  1986 to (current_year - 1)
      - Monthly files: Jan to (current_month - 1) of current_year
      - Daily files:   day 1 of current_month up to (today - 2) [fills gap before daily cron]
    """
    today = datetime.now(timezone.utc).date()
    current_year = today.year

    conn = psycopg2.connect(database_url)
    try:
        cur = conn.cursor()
        cur.execute('SELECT "tickerCotacao" FROM ativos')
        valid_tickers: set[str] = {row[0] for row in cur.fetchall()}
        print(f"{len(valid_tickers)} valid ticker(s) for price lookup")

        # 1. Annual files: 1986 through previous year
        for year in range(1986, current_year):
            fname = f"COTAHIST_A{year}"
            url = f"{_B3_BASE}/{fname}.ZIP"
            try:
                data = _download(url)
                z, f = _open_zip_txt(data, fname)
                with z, f:
                    rows = _batch_upsert_cotacoes(cur, _stream_cotacoes(f, valid_tickers))
                conn.commit()
                print(f"{year}: {rows} rows")
            except Exception as exc:
                conn.rollback()
                print(f"{year}: ERROR — {exc}")

        # 2. Monthly files: Jan through last completed month of current year
        for month in range(1, today.month):
            fname = f"COTAHIST_M{month:02d}{current_year}"
            url = f"{_B3_BASE}/{fname}.ZIP"
            try:
                data = _download(url)
                z, f = _open_zip_txt(data, fname)
                with z, f:
                    rows = _batch_upsert_cotacoes(cur, _stream_cotacoes(f, valid_tickers))
                conn.commit()
                print(f"{current_year}-{month:02d}: {rows} rows")
            except Exception as exc:
                conn.rollback()
                print(f"{current_year}-{month:02d}: ERROR — {exc}")

        # 3. Daily files: from day 1 of current month up to 2 days before today
        #    (the daily cron covers today-1 onward)
        d = today.replace(day=1)
        cutoff = today - timedelta(days=2)
        while d <= cutoff:
            fname = f"COTAHIST_D{d.strftime('%d%m%Y')}"
            url = f"{_B3_BASE}/{fname}.ZIP"
            try:
                data = _download(url)
                z, f = _open_zip_txt(data, fname)
                with z, f:
                    rows = _batch_upsert_cotacoes(cur, _stream_cotacoes(f, valid_tickers))
                conn.commit()
                print(f"{d}: {rows} rows")
            except (requests.HTTPError, KeyError, zipfile.BadZipFile):
                pass  # weekend or holiday — no file exists
            except Exception as exc:
                conn.rollback()
                print(f"{d}: ERROR — {exc}")
            d += timedelta(days=1)

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    load_dotenv()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable is not set")
        sys.exit(1)

    if os.environ.get("BACKFILL_ALL", "false").lower() == "true":
        run_backfill_all(database_url)
        return

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
