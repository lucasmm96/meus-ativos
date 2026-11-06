-- ---------------------------------------------------------------------------
-- Row Level Security (RLS) — enable and define per-table access policies
-- ---------------------------------------------------------------------------

-- Enable RLS on each table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;

-- users: select/update own row only
CREATE POLICY users_self ON users
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- transacoes: full CRUD own rows
CREATE POLICY transacoes_owner ON transacoes
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- arquivamentos: select/insert/delete own rows
CREATE POLICY arquivamentos_owner ON arquivamentos
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- ativos: anyone authenticated can read, writes blocked (service role only)
CREATE POLICY ativos_read ON ativos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- cotacoes: anyone authenticated can read, writes blocked (service role only)
CREATE POLICY cotacoes_read ON cotacoes FOR SELECT
  USING (auth.uid() IS NOT NULL);
