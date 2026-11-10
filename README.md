# meus-ativos

Aplicativo pessoal para acompanhar ativos, transações e preços históricos da B3.

## Stack

- React 18 + TypeScript + Vite (PWA)
- Tailwind CSS + Recharts
- Neon Postgres + PostgREST (Data API) + Drizzle ORM
- Ingestão COTAHIST e eventos corporativos em Python 3.11

## Arquitetura de dados

O app não tem backend próprio: o React fala diretamente com o Neon (Auth + Data API/PostgREST). O login devolve um JWT, enviado como `Authorization: Bearer` em cada chamada; o Postgres aplica RLS por usuário. Cálculos financeiros rodam no cliente com `decimal.js`.

| Objeto | Papel |
|---|---|
| `ativos` | Cadastro de tickers (`ticker`, `tickerCotacao`, `tipo` ACAO/FII, `nome`). `tickerCotacao` liga o ticker negociado ao ticker da série de preços. |
| `cotacoes` | Série COTAHIST por ativo/data (`precoFechamento` bruto), carregada pela ingestão Python. |
| `transacoes` | Compras do usuário: `userId`, `ativoTicker`, `data`, `valorUnitario`, `quantidade` e `ajustadaManualmente` (migration 0004). |
| `arquivamentos` | Arquivamento lógico de transações por usuário (soft delete na UI). |
| `eventos_corporativos` | Eventos normalizados (`tipo`, `ticker`, `data_efetiva`, `fator_ajuste`, `fonte`), com unicidade em `(tipo, ticker, data_efetiva)`. |
| `backfill_progress` | Estado por ticker do backfill histórico de eventos (`pendente`, `em_andamento`, `concluido`, `falha`, `pulado`). |
| `cotacoes_ajustadas` (view) | `preco_ajustado = preco_bruto / Π(fatores de eventos com data_efetiva > data)`; `confiabilidade = 'alta'` a partir de 2010-01-01 e `'baixa'` antes. `security_invoker = true`, então respeita o RLS das tabelas base. |

O frontend lê `preco_ajustado` da view. Para transações, `fatoresPorTransacao` multiplica a quantidade e divide o preço unitário pelos fatores de SPLIT/GRUPAMENTO/BONIFICACAO posteriores à compra; o custo original é preservado. Dashboard e Transactions usam essa quantidade ajustada em P&L, preço médio e evolução patrimonial.

As migrations SQL ficam em `scripts/migrations/` (0000–0004) e são aplicadas manualmente, em ordem. O schema Drizzle em `src/db/schema.ts` documenta as tabelas, mas as migrations versionadas são os arquivos SQL.

## Como rodar

Pré-requisitos:

- Node.js (LTS) + npm
- Python 3.11+ (ingestão e backfill)
- Projeto Neon com Auth e Data API habilitados (Postgres + PostgREST)

1. Instale as dependências do frontend:

```bash
npm install
```

2. Crie `.env.local` (não versionado) com:

- `DATABASE_URL` — conexão direta/pooled do Neon, usada pela ingestão Python e pelos workflows
- `VITE_NEON_AUTH_URL` — endpoint do Neon Auth
- `VITE_NEON_DATA_API_URL` — endpoint da Data API/PostgREST
- `DADOS_B3_API_KEY` — chave gratuita do dados-b3-mcp (apenas para o backfill de eventos)

3. Aplique as migrations em ordem, no SQL Editor do Neon ou via `psql`:

```text
scripts/migrations/0000_rls.sql
scripts/migrations/0001_eventos_corporativos.sql
scripts/migrations/0002_cotacoes_ajustadas.sql
scripts/migrations/0003_backfill_progress.sql
scripts/migrations/0004_transacoes_ajustada_manualmente.sql
```

Todas são idempotentes. Detalhes em [Migrations](#migrations).

4. Rode o frontend e valide:

```bash
npm run dev       # desenvolvimento
npm run test:run  # testes frontend (Vitest)
npm run build     # type-check + build de produção
```

5. Popule os dados:

- **COTAHIST:** workflow `.github/workflows/ingest.yml` roda de terça a sábado (01:00 UTC); `backfill.yml` é manual para o histórico completo; `reconcile.yml` reconcilia o mês anterior todo dia 5. Todos usam `secrets.DATABASE_URL`.
- **Eventos recentes:** workflow `.github/workflows/eventos-corporativos.yml` roda toda segunda-feira (06:00 UTC) e aceita `workflow_dispatch`.
- **Backfill histórico de eventos:** execução manual do Script B, descrita em [Backfill (Script B)](#backfill-script-b).

## Estado atual

- Fases 1–6 da continuidade histórica concluídas no branch `dev` (eventos corporativos, view ajustada, tela `/ativos/:ticker`, P&L ajustado e transações pré-2010, override manual e CSV). A Fase 7 (linhagem de tickers) foi removida do escopo.
- Frontend: 101 testes em 10 arquivos (`npx vitest run --dir src`), `npm run build` e `npx tsc -b --noEmit` sem erros.
- Backfill de eventos: 300 tickers `concluido`, 281 `pulado`, 0 `falha`; 274 eventos carregados em 179 tickers.
- Migrations 0001–0004 aplicadas e idempotentes no ambiente de desenvolvimento.
- Pendente: abrir e mergear o PR `dev → master`. O workflow de eventos ainda usa `secrets.DATABASE_URL_DEV`; após o merge, validar com um `workflow_dispatch` em `master` e só então trocar para `secrets.DATABASE_URL` em um PR separado (1 linha). Depois disso o cron semanal passa a rodar em produção.

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
- **VALE3 — sem evento pós-2010:** VALE3 não teve split, grupamento ou bonificação após 2007-08-31 (eventos anteriores: desdobramentos 2004-08-19, 2006-05-22 e 2007-08-31, todos pré-2010). A série histórica de VALE3 no app é bruta, e a fonte dados-b3-mcp está correta ao omitir eventos pós-2010. A UI exibe o badge "Série pode não estar ajustada" porque VALE3 tem histórico >5 anos e nenhum evento registrado — o badge é informativo, não indica lacuna da fonte.
- **Tickers pulados (281):**
  - 272 FIIs: motivo `fonte não cobre FIIs`.
  - 5 ações (`ALUP3`, `ALUP4`, `AZUL97`, `AZUL99`, `IBOV11`): motivo `sem cobertura na fonte: dadosb3.com`.
  - 4 ações (`INEP4`, `KLBN3`, `KLBN4`, `RAIZ55`): motivo `ticker desconhecido na fonte: dadosb3.com`.
- **Contagem final:** 274 eventos corporativos carregados, distribuídos em 179 tickers (SPLIT 122, BONIFICACAO 78, GRUPAMENTO 74). Fonte única: dados-b3-mcp.
- **Reversão de pulados:** tickers marcados `pulado` podem ser revertidos para `pendente` se a fonte passar a cobri-los: `UPDATE backfill_progress SET status = 'pendente', motivo_falha = NULL WHERE ticker = 'X'` e rodar o backfill novamente.

### Backfill (Script B)

A chave gratuita do dados-b3-mcp permite **200 consultas por dia**, com reset quando o dia vira no relógio do servidor. O banco tem 309 ações e 272 FIIs:

- **3 execuções em dias distintos** (200 + 200 + 9 consultas de quota).
- Concluído em 2026-11-10: 300 ações `concluido`, 281 `pulado` (272 FIIs + 9 ações), 0 falhas.
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

O workflow `.github/workflows/eventos-corporativos.yml` usa `secrets.DATABASE_URL_DEV` enquanto está no branch `dev`. Os workflows de COTAHIST (`ingest.yml`, `backfill.yml`, `reconcile.yml`) usam `secrets.DATABASE_URL`, que aponta para produção.

O PR `dev → master` mantém `DATABASE_URL_DEV` no workflow de eventos: após o merge, um `workflow_dispatch` em `master` valida o mecanismo de ponta a ponta contra o banco de desenvolvimento (consome 1 chamada de `/eventos`). Se passar, um PR separado troca `secrets.DATABASE_URL_DEV` por `secrets.DATABASE_URL` (1 linha) e, após novo merge, o cron semanal passa a rodar em produção. `workflow_dispatch` exige o workflow no branch default, por isso a validação só é possível após o primeiro merge.

### Regras de ajuste

- `fator_ajuste` = `efeito_liquido_do_dia`; `fator_declarado` não é usado.
- `data_efetiva` = primeiro pregão COTAHIST estritamente posterior a `data_ex`. Sem pregão posterior, o evento é descartado (sem fallback para dia corrido).
- Duplicatas com mesmo fator (tolerância `1e-9`) viram uma linha; fatores conflitantes descartam o evento inteiro com warning.
- Eventos com `fator` nulo, não numérico, `<= 0` ou `divergente_do_preco` são descartados.
- **Eventos divergentes descartados não são rastreados por ticker.** Apenas o log registra ticker/data/tipo/motivo; a UI não consegue sinalizar o ticker específico.

### Tela `/ativos/:ticker`

- Gráfico de `preco_ajustado` com linha sólida pós-2010 e tracejada pré-2010, marcador em 2010-01-01 e um marcador vertical por evento.
- Tooltip de evento mostra tipo humanizado, fator de ajuste e data (ex.: `Split 1:1.5 em 21/11/2018`); sem fator, mostra só tipo e data.
- Badge "Série ajustada" quando o período exibido tem `fator_divisor != 1`.
- FIIs mostram badge específico: eventos corporativos de FII não têm cobertura; a série é bruta, sem ajuste.
- Ações sem eventos registrados e com histórico anterior a 5 anos mostram aviso amarelo de cobertura.
- Rodapé informa que apenas desdobramentos automáticos estão registrados; outros eventos podem faltar.
- Eventos terminais (cisão, fusão, incorporação, cancelamento) geram banner próprio.
- Indicadores (retorno, CAGR, volatilidade) usam apenas linhas com `confiabilidade = 'alta'`; quando não há série suficiente, exibem "—".
- A tela lê apenas o ticker atual; não há linhagem de tickers (Fase 7 removida).

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
scripts/migrations/0004_transacoes_ajustada_manualmente.sql
```

Todas são idempotentes.

## Limitações conhecidas

- **FIIs:** cobertura zero de eventos corporativos nas duas rotas do dados-b3-mcp. A série é bruta e a UI mostra badge específico; não há como ajustar FIIs automaticamente.
- **Mudança de ticker:** sem fonte de verdade. A tela `/ativos/:ticker` lê apenas o ticker atual (Fase 7 removida); transações com ticker ausente de `ativos` não recebem cotação.
- **Cobertura histórica:** eventos confiáveis a partir de 2010. Preços anteriores a 2010 têm `confiabilidade = 'baixa'` e são exibidos tracejados; eventos corporativos entre a compra e 2010 podem não estar refletidos. P&L e CSV avisam quando há transação pré-2010.
- **Tipos de evento:** apenas SPLIT, GRUPAMENTO e BONIFICACAO ajustam quantidade/preço. SUBSCRICAO, CISAO, FUSAO, INCORPORACAO, MUDANCA_TICKER e MUDANCA_NOME não alteram a série; eventos terminais geram banner na tela do ativo.
- **Proventos:** dividendos e JCP não fazem parte da série ajustada; o ajuste cobre apenas eventos que alteram quantidade/preço.
- **Eventos divergentes** descartados pela validação não são rastreados por ticker; apenas o log da ingestão registra ticker/data/tipo/motivo.
- **VALE3:** sem eventos pós-2010 (fonte correta ao omitir). O badge "Série pode não estar ajustada" é informativo, não indica lacuna da fonte.
- **Backfill:** 281 tickers pulados — 272 FIIs e 9 ações sem cobertura/ticker desconhecido na fonte (`ALUP3`, `ALUP4`, `AZUL97`, `AZUL99`, `IBOV11`, `INEP4`, `KLBN3`, `KLBN4`, `RAIZ55`).
- **CSV de transações:** exporta quantidade e preço **ajustados** (os mesmos exibidos na UI), não os valores originais gravados no banco. Para reconciliação, o tooltip da lista mostra o valor original; colunas `quantidadeOriginal`/`valorUnitarioOriginal` no CSV são melhoria futura.
- **P&L:** usa custo original (`valorInvestido`) contra valor de mercado ajustado. Não considera taxas, corretagem, IR nem proventos recebidos.
- **Quota do dados-b3-mcp:** 200 consultas/dia na chave gratuita. O backfill precisa de múltiplas execuções; interrupções são retomadas por `backfill_progress`.

## Testes

```bash
npm run test:run
DATABASE_URL=... scripts/venv/bin/python -m pytest scripts/tests -v
```
