-- ---------------------------------------------------------------------------
-- Eventos corporativos — schema, índices e RLS
-- Idempotente: seguro executar mais de uma vez.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE tipo_evento_corporativo AS ENUM (
    'SPLIT',
    'GRUPAMENTO',
    'BONIFICACAO',
    'SUBSCRICAO',
    'MUDANCA_TICKER',
    'MUDANCA_NOME',
    'CISAO',
    'FUSAO',
    'INCORPORACAO',
    'IPO',
    'CANCELAMENTO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS eventos_corporativos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo               tipo_evento_corporativo NOT NULL,
  ticker             varchar(10) NOT NULL,
  ticker_relacionado varchar(10),           -- para MUDANCA_TICKER, CISAO, FUSAO, INCORPORACAO
  data_efetiva       date NOT NULL,         -- primeiro pregão pós-evento (ex-date)
  fator_ajuste       numeric(18, 10),       -- NULL para tipos não-numéricos; SPLIT 1:4 -> 4.0
  descricao          text,
  fonte              varchar(50) NOT NULL,  -- 'dados-b3-mcp', 'backfill_b3', etc.
  fonte_url          text,
  ingerido_em        timestamp NOT NULL DEFAULT now()
);

-- Unicidade lógica do evento (também alvo do ON CONFLICT dos scripts)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tipo_ticker_data
  ON eventos_corporativos (tipo, ticker, data_efetiva);

-- Índice parcial para o JOIN da view cotacoes_ajustadas
CREATE INDEX IF NOT EXISTS idx_eventos_ajuste
  ON eventos_corporativos (ticker, data_efetiva)
  WHERE tipo IN ('SPLIT', 'GRUPAMENTO', 'BONIFICACAO')
    AND fator_ajuste IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS: leitura para authenticated; escrita apenas via service role
-- ---------------------------------------------------------------------------

ALTER TABLE eventos_corporativos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'eventos_corporativos'
      AND policyname = 'eventos_read'
  ) THEN
    CREATE POLICY eventos_read ON eventos_corporativos FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

GRANT SELECT ON eventos_corporativos TO authenticated;
