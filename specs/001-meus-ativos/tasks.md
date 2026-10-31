# TASKS — Orquestração Paralela

## REGRAS DE VERSIONAMENTO E ENTREGA

1. O Agente Gerenciador deve criar uma branch para cada trilha antes de iniciar o subagente (ex: `feat/db-schema`, `feat/core-calculos`).
2. Nenhum subagente deve fazer commit na `main`.
3. Ao finalizar uma trilha, o subagente deve fazer o commit na sua branch e o Agente Gerenciador deve abrir um Pull Request para a `main`.
4. O Agente Gerenciador só faz o merge se os testes (Vitest) passarem no GitHub Actions.

O agente gerenciador deve criar subagentes e atribuir as trilhas abaixo.
Regra de Ouro: Nenhum subagente pode alterar arquivos fora da sua trilha.
A integração é feita pelo gerenciador após a conclusão de todas as trilhas.

## Trilha A — Fundação e Banco de Dados (db-agent)
**Arquivos:** `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, scripts de migração.
**Tarefas:**
1. Definir schema Drizzle: `users`, `ativos`, `transacoes`, `cotacoes`, `arquivamentos`.
2. Configurar o client do Neon Data API.
3. Implementar RLS (Row Level Security) no Postgres.

## Trilha B — Core Financeiro (core-agent)
**Arquivos:** `src/core/calculo.ts`, `src/core/__tests__/calculo.test.ts`.
**Tarefas:**
1. Implementar funções puras com `decimal.js`: `calcularTotalTransacao`, `calcularPrecoMedio`, `calcularValorMercado`, `calcularPnL`.
2. Criar fixtures de teste baseadas nos 118 registros da planilha (ignorar datas erradas, considerar como oráculo).

## Trilha C — Ingestão de Dados (infra-agent)
**Arquivos:** `scripts/ingestao/requirements.txt`, `scripts/ingestao/main.py`, `.github/workflows/ingest.yml`.
**Tarefas:**
1. Criar script Python usando `b3quant` para baixar o COTAHIST e converter para JSON.
2. Configurar GitHub Action (cron diário) para rodar o script e fazer o upsert no Neon (usando DATABASE_URL via secret).

## Trilha D — Design System e Componentes (ui-agent)
**Arquivos:** `src/components/**`, `tailwind.config.ts`, `src/index.css`.
**Tarefas:**
1. Configurar tokens de cores (Verde Ações, Azul FIIs, Dark Mode).
2. Criar componentes primitivos: `Button`, `Input`, `Card`, `OfflineBanner`.

## Trilha E — Páginas, Rotas e Gráficos (page-agent)
**Arquivos:** `src/routes/**`, `src/App.tsx`, `src/components/charts/**`.
**Tarefas:**
1. Configurar React Router v6.
2. Criar telas de Login e Cadastro (integradas ao Neon Auth).
3. Criar Dashboard com os 6 gráficos (Recharts) e cards de resumo.
4. Criar tela de transações (CRUD) e botão de arquivamento.

## Trilha F — QA e Integração (qa-agent)
**Arquivos:** `vitest.config.ts`, `vercel.json`, `src/components/__tests__/**`.
**Tarefas:**
1. Configurar o `vercel.json` com rewrite para SPA.
2. Garantir que o CI (GitHub Actions) rode o Vitest e valide o threshold de cobertura.