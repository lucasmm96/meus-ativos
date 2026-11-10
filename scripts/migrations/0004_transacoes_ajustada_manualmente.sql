-- ---------------------------------------------------------------------------
-- Fase 6 — flag de ajuste manual em transações
-- Idempotente: seguro executar mais de uma vez.
-- ---------------------------------------------------------------------------

ALTER TABLE transacoes
  ADD COLUMN IF NOT EXISTS "ajustadaManualmente" boolean NOT NULL DEFAULT false;
