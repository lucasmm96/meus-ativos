-- ---------------------------------------------------------------------------
-- View de cotações ajustadas por eventos corporativos
-- Idempotente: CREATE OR REPLACE VIEW + IF NOT EXISTS no índice.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cotacoes_ticker_data
  ON cotacoes ("ativoTicker", data DESC);

CREATE OR REPLACE VIEW cotacoes_ajustadas
  WITH (security_invoker = true)
AS
WITH eventos_ajuste AS (
  SELECT ticker, data_efetiva, fator_ajuste
  FROM eventos_corporativos
  WHERE tipo IN ('SPLIT', 'GRUPAMENTO', 'BONIFICACAO')
    AND fator_ajuste IS NOT NULL
),
com_fator AS (
  SELECT
    c."ativoTicker",
    c.data,
    c."precoFechamento",
    ROUND(
      EXP(COALESCE(SUM(LN(ea.fator_ajuste::float8)), 0.0))::numeric,
      10
    ) AS fator_divisor
  FROM cotacoes c
  LEFT JOIN eventos_ajuste ea
    ON ea.ticker = c."ativoTicker"
    AND ea.data_efetiva > c.data
  GROUP BY c."ativoTicker", c.data, c."precoFechamento"
)
SELECT
  "ativoTicker",
  data,
  "precoFechamento"                                    AS preco_bruto,
  ("precoFechamento" / fator_divisor)::numeric(18, 6)  AS preco_ajustado,
  fator_divisor,
  CASE
    WHEN data >= '2010-01-01' THEN 'alta'
    ELSE 'baixa'
  END AS confiabilidade
FROM com_fator;

GRANT SELECT ON cotacoes_ajustadas TO authenticated;
