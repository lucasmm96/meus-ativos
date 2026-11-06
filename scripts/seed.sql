-- ---------------------------------------------------------------------------
-- Seed: initial ativos catalog (B3 assets)
-- ---------------------------------------------------------------------------
-- tickerCotacao stores the base ticker WITHOUT the "F" suffix used for
-- fractional-share trading (e.g., ITSA4F → tickerCotacao = ITSA4).
-- ---------------------------------------------------------------------------

INSERT INTO ativos (ticker, nome, tipo, "tickerCotacao") VALUES
  -- Ações
  ('ITSA4',  'Itaúsa',                  'ACAO', 'ITSA4'),
  ('BBAS3',  'Banco do Brasil',          'ACAO', 'BBAS3'),
  ('TAEE11', 'Transmissora Aliança',     'ACAO', 'TAEE11'),
  ('BBSE3',  'BB Seguridade',            'ACAO', 'BBSE3'),
  ('VALE3',  'Vale',                     'ACAO', 'VALE3'),
  ('PETR4',  'Petrobras',               'ACAO', 'PETR4'),
  -- FIIs
  ('HGLG11', 'CSHG Logística',          'FII',  'HGLG11'),
  ('MXRF11', 'Maxi Renda',              'FII',  'MXRF11'),
  ('XPML11', 'XP Malls',               'FII',  'XPML11'),
  ('PVBI11', 'VBI Prime Properties',    'FII',  'PVBI11'),
  ('RBRP11', 'RBR Properties',          'FII',  'RBRP11')
ON CONFLICT DO NOTHING;
