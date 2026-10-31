# SCRIPT DE INGESTÃO (PYTHON)

- **Local:** `scripts/ingestao/main.py`
- **Dependências:** `b3quant`, `psycopg2-binary`, `python-dotenv`
- **Lógica:**
  1. Baixar COTAHIST do dia atual (ou anual para backfill).
  2. Filtrar apenas os tickers presentes na tabela `ativos` (coluna `ticker_cotacao`).
  3. Fazer UPSERT na tabela `cotacoes` (ignorar se já existir registro para o mesmo ticker e data).
- **GitHub Actions (`.github/workflows/ingest.yml`):**
  - Cron: `0 21 * * 1-5` (21h UTC = 18h BRT, após fechamento).
  - Executar `python scripts/ingestao/main.py`.