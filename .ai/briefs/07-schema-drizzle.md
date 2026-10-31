# SCHEMA DRIZZLE (src/db/schema.ts)

- `users`: id (uuid, PK), email (text, unique), createdAt (timestamp).
- `ativos`: ticker (varchar 10, PK), nome (text), tipo (enum: 'ACAO', 'FII'), tickerCotacao (varchar 10).
- `transacoes`: id (uuid, PK), userId (uuid, FK), ativoTicker (varchar, FK), data (date), valorUnitario (numeric 18,6), quantidade (integer), createdAt (timestamp).
- `cotacoes`: ativoTicker (varchar, FK), data (date), precoFechamento (numeric 18,6). PK composta: (ativoTicker, data).
- `arquivamentos`: userId (uuid, FK), ativoTicker (varchar, FK), dataArquivamento (date). PK composta: (userId, ativoTicker).

**Regras:**
- Usar `numeric` para valores financeiros e `date` para datas (sem timezone para evitar problemas com fusos).
- A tabela `cotacoes` não tem `user_id`, é global.