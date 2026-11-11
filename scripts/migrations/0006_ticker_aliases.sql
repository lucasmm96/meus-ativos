-- ---------------------------------------------------------------------------
-- Migration 0006 — suporte a tickers extintos/renomeados (alias)
--
-- Adiciona coluna `negociavel` em `ativos` (false = alias de ticker extinto).
-- Insere alias CPLE6 → CPLE3 (Copel PN extinto em dez/2025, conversão 1:1).
-- Recria `ativos_resumo` filtrando linhas alias (negociavel = false).
-- Idempotente.
-- ---------------------------------------------------------------------------

ALTER TABLE ativos
  ADD COLUMN IF NOT EXISTS negociavel BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN ativos.negociavel IS
  'true = ativo negociado normalmente; false = alias de ticker extinto (usado apenas como mapeamento de cotação)';

-- Alias para CPLE6 → CPLE3
-- Copel migrou para o Novo Mercado em dez/2025: CPLE6 convertida 1:1 em CPLE3 + R$0,7749/ação em caixa.
INSERT INTO ativos (ticker, nome, tipo, "tickerCotacao", negociavel)
VALUES ('CPLE6', 'Copel PN (extinto)', 'ACAO', 'CPLE3', false)
ON CONFLICT (ticker) DO UPDATE
  SET "tickerCotacao" = EXCLUDED."tickerCotacao",
      negociavel      = false;

-- Recria ativos_resumo com filtro negociavel = true na CTE `ultima`.
-- A CROSS JOIN LATERAL já excluiria alias rows naturalmente (sem cotações
-- no próprio ticker), mas o WHERE explícito é mais seguro e auto-documentado.
CREATE OR REPLACE VIEW ativos_resumo
  WITH (security_invoker = true)
AS
WITH ultima AS MATERIALIZED (
  SELECT
    a.ticker,
    c.data AS data_ultima,
    (c."precoFechamento"::numeric / f.fator)::numeric(18, 6) AS preco_atual
  FROM ativos a
  CROSS JOIN LATERAL (
    SELECT data, "precoFechamento"
    FROM cotacoes
    WHERE "ativoTicker" = a.ticker
    ORDER BY data DESC
    LIMIT 1
  ) c
  CROSS JOIN LATERAL (
    SELECT EXP(COALESCE(SUM(LN(e.fator_ajuste::float8)), 0.0)) AS fator
    FROM eventos_corporativos e
    WHERE e.ticker = a.ticker
      AND e.tipo IN ('SPLIT', 'GRUPAMENTO', 'BONIFICACAO')
      AND e.fator_ajuste IS NOT NULL
      AND e.data_efetiva > c.data
  ) f
  WHERE a.negociavel = true
),
janela AS (
  SELECT
    c."ativoTicker" AS ticker,
    c.data,
    c."precoFechamento"::numeric AS preco_bruto,
    true AS eh_cotacao,
    NULL::numeric AS fator
  FROM cotacoes c
  JOIN ultima u ON u.ticker = c."ativoTicker"
  WHERE c.data > u.data_ultima - INTERVAL '1 year'
  UNION ALL
  SELECT
    e.ticker,
    e.data_efetiva,
    NULL,
    false,
    e.fator_ajuste
  FROM eventos_corporativos e
  JOIN ultima u ON u.ticker = e.ticker
  WHERE e.tipo IN ('SPLIT', 'GRUPAMENTO', 'BONIFICACAO')
    AND e.fator_ajuste IS NOT NULL
    AND e.data_efetiva > u.data_ultima - INTERVAL '1 year'
),
calc AS (
  SELECT
    ticker,
    preco_bruto,
    eh_cotacao,
    SUM(COALESCE(LN(fator::float8), 0.0)) OVER (
      PARTITION BY ticker
      ORDER BY data DESC, eh_cotacao DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS soma_ln
  FROM janela
),
faixa_52s AS (
  SELECT
    ticker,
    MAX(preco_bruto / EXP(soma_ln))::numeric(18, 6) AS maxima_52s,
    MIN(preco_bruto / EXP(soma_ln))::numeric(18, 6) AS minima_52s
  FROM calc
  WHERE eh_cotacao
  GROUP BY ticker
),
preco_12m_bruto AS MATERIALIZED (
  SELECT
    u.ticker,
    c.data,
    c."precoFechamento"::numeric AS preco_bruto
  FROM ultima u
  CROSS JOIN LATERAL (
    SELECT data, "precoFechamento"
    FROM cotacoes
    WHERE "ativoTicker" = u.ticker
      AND data <= u.data_ultima - INTERVAL '1 year'
    ORDER BY data DESC
    LIMIT 1
  ) c
),
preco_12m AS (
  SELECT
    p.ticker,
    (p.preco_bruto / EXP(COALESCE(SUM(LN(e.fator_ajuste::float8)), 0.0)))::numeric(18, 6) AS preco_12m
  FROM preco_12m_bruto p
  LEFT JOIN eventos_corporativos e
    ON e.ticker = p.ticker
   AND e.tipo IN ('SPLIT', 'GRUPAMENTO', 'BONIFICACAO')
   AND e.fator_ajuste IS NOT NULL
   AND e.data_efetiva > p.data
  GROUP BY p.ticker, p.preco_bruto
)
SELECT
  a.ticker,
  a.nome,
  a.tipo,
  u.data_ultima,
  u.preco_atual,
  f.maxima_52s,
  f.minima_52s,
  p.preco_12m,
  ROUND((u.preco_atual / NULLIF(p.preco_12m, 0) - 1)::numeric, 6) AS retorno_12m
FROM ativos a
JOIN ultima u         ON u.ticker = a.ticker
LEFT JOIN faixa_52s f ON f.ticker = a.ticker
LEFT JOIN preco_12m p ON p.ticker = a.ticker;

GRANT SELECT ON ativos_resumo TO authenticated;

COMMENT ON VIEW ativos_resumo IS
  'Resumo por ativo para o explorador /ativos: preço atual ajustado, faixa 52s e retorno 12m. Exclui aliases (negociavel = false).';

NOTIFY pgrst, 'reload schema';
