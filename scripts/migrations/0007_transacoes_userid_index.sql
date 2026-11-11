-- Migration 0007 — índice em transacoes."userId"
-- Toda rota faz WHERE "userId" = $1 nesta tabela.
-- Sem índice: sequential scan; com índice: index scan.
CREATE INDEX IF NOT EXISTS transacoes_userid_idx ON transacoes ("userId");
