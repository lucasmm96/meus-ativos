# REGRAS FINANCEIRAS (src/core/)

1. **Preço Médio:** Soma de `(valor_unitario * quantidade)` de todas as transações de um ativo, dividido pela soma de `quantidade`.
2. **P&L (Lucro/Prejuízo):** `(Cotação Atual - Preço Médio) * Quantidade Total`.
3. **Valor de Mercado:** `Cotação Atual * Quantidade Total`.
4. **Tickers:** Para buscar a cotação, usar a coluna `ticker_cotacao` (que remove o "F").
5. **Fixtures:** O JSON de teste deve ter dados reais da planilha.