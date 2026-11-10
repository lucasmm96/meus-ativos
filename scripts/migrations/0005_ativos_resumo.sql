-- ---------------------------------------------------------------------------
-- Fase 7 — Consulta de ativos: resumo por ticker
-- View usada pela página /ativos (explorador). Evita puxar 1,3M de linhas
-- de cotacoes para o cliente: entrega uma linha por ativo com preço atual,
-- faixa de 52 semanas e retorno de 12 meses, tudo em preços ajustados.
--
-- Performance: os CTEs MATERIALIZED e os LATERAL por ticker evitam varrer
-- a tabela inteira mais de uma vez. Tempo medido em dev: ~0,6s para 581 ativos.
-- Idempotente: CREATE OR REPLACE VIEW.
-- ---------------------------------------------------------------------------

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
  -- Fator acumulado dos eventos posteriores a cada cotação, em uma única
  -- passagem: eventos entram na mesma ordenação (data DESC) e são somados
  -- em log; para a cotação na mesma data do evento, o evento fica fora do
  -- frame (eh_cotacao DESC), respeitando a regra `data_efetiva > data`.
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
JOIN ultima u        ON u.ticker = a.ticker
LEFT JOIN faixa_52s f ON f.ticker = a.ticker
LEFT JOIN preco_12m p ON p.ticker = a.ticker;

GRANT SELECT ON ativos_resumo TO authenticated;

COMMENT ON VIEW ativos_resumo IS
  'Resumo por ativo para o explorador /ativos: preço atual ajustado, faixa 52s e retorno 12m.';
