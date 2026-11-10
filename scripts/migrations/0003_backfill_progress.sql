-- ---------------------------------------------------------------------------
-- Estado do backfill histórico de eventos corporativos (Script B)
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS + DO block para RLS.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS backfill_progress (
  ticker varchar(10) PRIMARY KEY REFERENCES ativos(ticker) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'falha', 'pulado')),
  ultima_tentativa timestamptz,
  motivo_falha text
);

CREATE INDEX IF NOT EXISTS idx_backfill_progress_pendentes
  ON backfill_progress (status)
  WHERE status <> 'concluido';

ALTER TABLE backfill_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON backfill_progress FROM PUBLIC;
