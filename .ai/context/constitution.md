# CONSTITUTION — Meus Ativos

## 1. Stack Tecnológica e Padrões
- **Frontend:** React + TypeScript + Vite.
- **Estilização:** Tailwind CSS (tokens customizados, sem hex hardcoded) + Dark Mode nativo.
- **Ícones e Roteamento:** Material Symbols (CDN) + React Router v6.
- **PWA:** vite-plugin-pwa. **Offline:** O app exige conexão com a internet. Aviso visual persistente (banner) se offline. Sem fila de sincronização offline.
- **Gráficos:** Recharts. Cores padrão: Verde (`#4CAF50`) para Ações, Azul (`#2196F3`) para FIIs.
- **Backend/Banco:** Neon (Postgres Serverless) + Drizzle ORM + decimal.js.
- **Auth:** Neon Auth. O app terá tela de login e cadastro. O **Signup é ABERTO** (qualquer pessoa pode se cadastrar). Sessão persistente ("Lembrar de mim") habilitada. *Nota de infra: Configurar rate limit no Neon para evitar spam.*

## 2. Arquitetura de Dados e APIs
- **Separação:** `src/core/` (regras puras, sem UI/DB), `src/db/` (queries e schema), `src/routes/` (páginas), `src/components/` (UI).
- **Acesso a Dados:** O frontend usa a Neon Data API via PostgREST, injetando o JWT. RLS (Row Level Security) é estrito: usuários só acessam seus próprios dados.
- **Tabela `cotacoes`:** Compartilhada. Leitura liberada para autenticados; escrita apenas via *service role*.
- **API Externa:** O frontend NUNCA chama APIs externas. A ingestão de dados é feita exclusivamente por scripts no GitHub Actions.

## 3. Ingestão de Cotações (COTAHIST)
- **Fonte:** Arquivo COTAHIST da B3.
- **Script:** Python isolado em `scripts/ingestao/` rodando no GitHub Actions.
- **Frequência:** Diária (via cron no Actions, pós-fechamento).
- **Escopo do Dado:** Apenas o preço de fechamento (`close_price`).
- **Backfill:** O script processará o arquivo anual para popular o histórico desde a data de corte.

## 4. Regras de Negócio e Arquivamento
- **Cálculo:** Toda matemática financeira usa `decimal.js` no `src/core/`.
- **Arquivamento:** Um ativo não é excluído. Ele é arquivado em uma tabela relacional (`arquivamentos`) contendo `user_id` e `ativo_ticker`. O gráfico de evolução respeita a data de arquivamento.
- **Vendas:** Não existem transações de venda. Apenas compras e arquivamento de posições.
- **Proventos:** Fora do escopo do MVP1 (avaliar no MVP2).

## 5. Testes e Deploy
- **Testes:** Vitest + Testing Library. O oráculo de testes será gerado a partir dos 118 registros da planilha Excel original (CSV).
- **Deploy:** Vercel (configurado com rewrite para SPA). Secrets (DATABASE_URL, chaves) injetados no GitHub Actions.