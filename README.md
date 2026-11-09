# meus-ativos

Aplicativo pessoal para acompanhar ativos, transações e preços históricos da B3.

## Stack

- React 18 + TypeScript + Vite (PWA)
- Tailwind CSS + Recharts
- Neon Postgres + PostgREST (Data API) + Drizzle ORM
- Ingestão COTAHIST e eventos corporativos em Python 3.11

## Desenvolvimento

```bash
npm install
npm run dev
```

Variáveis de ambiente ficam em `.env.local` (não versionado):

- `DATABASE_URL` — conexão Neon
- `DADOS_B3_API_KEY` — chave gratuita do dados-b3-mcp (backfill de eventos)

## Eventos corporativos

### Cobertura

| Fonte | Escopo | Situação |
|---|---|---|
| `/hoje` (dados-b3-mcp) | Eventos dos últimos 30 dias | Automático, cron semanal |
| `/eventos` (dados-b3-mcp) | Histórico por ação, 2010+ | Backfill manual, idempotente |
| FIIs | — | **Cobertura zero** nas duas rotas |
| Mudança de ticker | — | **Sem fonte de dados** |

- **Ações:** eventos de 2010 em diante são ingeridos pelo Script B; eventos recentes pelo Script A.
- **FIIs:** a ferramenta `/eventos` rejeita FIIs (`tente_assim → fii`) e `/hoje` não os retorna. Nenhum evento de FII é ingerido. A UI deve tratar FIIs como cobertura zero.
- **Mudança de ticker:** `/hoje.trocas` veio vazio mesmo com chave e `/eventos` não expõe trocas. Não há fonte de verdade. A UI avisa quando uma transação usa ticker ausente de `ativos`.
- **Tickers sem cobertura na fonte:** `ALUP3`, `ALUP4`, `AZUL97`, `AZUL99`, `IBOV11` estão marcados `pulado` com motivo `sem cobertura na fonte: dadosb3.com`. Reverter para `pendente` se a fonte passar a cobrir.

### Backfill (Script B)

A chave gratuita do dados-b3-mcp permite **200 consultas por dia**, com reset quando o dia vira no relógio do servidor. O banco tem 309 ações e 272 FIIs:

- **3 execuções em dias distintos** (200 + 200 + 9 consultas de quota).
- Em 2026-11-09 a primeira execução concluiu 95 ações; restam 209 consultas reais (200 no Dia 2, 9 no Dia 3).
- FIIs são marcados como `pulado` sem consumir quota.
- Tickers sem cobertura na fonte também são `pulado` sem consumir quota.

O progresso fica em `backfill_progress`; a segunda execução retoma nos tickers ainda não concluídos. Se uma execução for interrompida (queda de conexão ou quota esgotada), os tickers `concluido` não repetem e o restante é retomado na execução seguinte — falhas podem exigir execuções adicionais além das duas previstas.

```bash
# setup do ambiente Python
bash scripts/setup.sh
# Windows:
# scripts\venv\Scripts\python -m pip install -r scripts\requirements.txt

# Script A — eventos recentes (/hoje), manual ou cron
DATABASE_URL=... scripts/venv/bin/python scripts/ingestao/eventos_b3_mcp.py

# Script B — backfill histórico (/eventos), manual
DATABASE_URL=... DADOS_B3_API_KEY=... \
  scripts/venv/bin/python scripts/ingestao/eventos_b3_mcp_backfill.py
```

O Script B usa advisory lock em conexão direta (sem `-pooler`) para impedir duas execuções simultâneas. O Script A não usa lock e pode rodar durante o backfill; ambos fazem upsert idempotente por `(tipo, ticker, data_efetiva)`.

### GitHub Actions e secret

O workflow `.github/workflows/eventos-corporativos.yml` usa `secrets.DATABASE_URL_DEV` enquanto está no branch `dev`. Os workflows de COTAHIST (`ingest.yml`, `backfill.yml`, `reconcile.yml`) usam `secrets.DATABASE_URL`, que aponta para produção. No PR final `dev → master`, trocar o workflow de eventos para `secrets.DATABASE_URL`.

`workflow_dispatch` exige o workflow no branch default (`master`); o critério 5 fica deferido para o PR final.

### Regras de ajuste

- `fator_ajuste` = `efeito_liquido_do_dia`; `fator_declarado` não é usado.
- `data_efetiva` = primeiro pregão COTAHIST estritamente posterior a `data_ex`. Sem pregão posterior, o evento é descartado (sem fallback para dia corrido).
- Duplicatas com mesmo fator (tolerância `1e-9`) viram uma linha; fatores conflitantes descartam o evento inteiro com warning.
- Eventos com `fator` nulo, não numérico, `<= 0` ou `divergente_do_preco` são descartados.
- **Eventos divergentes descartados não são rastreados por ticker.** Apenas o log registra ticker/data/tipo/motivo; a UI não consegue sinalizar o ticker específico.

### Bugs corrigidos na execução real (2026-11-09)

- Cursor do Script B era fechado pelo bloco `with` e reutilizado no loop de tickers.
- Queda da conexão pooled da Neon no meio do lote: o handler chamava `rollback()` na conexão morta e abortava tudo. Agora reconecta e retenta o ticker até 3×.
- Quota esgotada chega como **HTTP 200 + `erro` textual**, não HTTP 429. Antes o script marcava `falha` e continuava consultando; agora aborta no primeiro erro de quota.

### Migrations

Aplicar em ordem:

```text
scripts/migrations/0000_rls.sql
scripts/migrations/0001_eventos_corporativos.sql
scripts/migrations/0002_cotacoes_ajustadas.sql
scripts/migrations/0003_backfill_progress.sql
```

Todas são idempotentes.

## Testes

```bash
npm run test:run
DATABASE_URL=... scripts/venv/bin/python -m pytest scripts/tests -v
```
