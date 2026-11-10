"""Testes da view cotacoes_ajustadas.

Requer: pip install psycopg2-binary pytest
Uso: DATABASE_URL=<neon-dev> pytest scripts/tests/test_view_cotacoes_ajustadas.py -v
"""

from datetime import date, timedelta

from fixtures import query_view, with_test_data


def test_split_preco_continuo():
    """Split 1:4: preco_ajustado deve ser contínuo no dia do evento."""
    ticker, d = 'TST001', date(2020, 6, 15)
    cotacoes = [(d - timedelta(i), 44.00) for i in range(1, 6)] + \
               [(d + timedelta(i), 11.00) for i in range(0, 5)]
    eventos = [{'tipo': 'SPLIT', 'ticker': ticker, 'data_efetiva': d, 'fator_ajuste': 4.0}]
    with with_test_data(ticker, cotacoes, eventos):
        rows = query_view(ticker)
        pre = next(r for r in rows if r['data'] == d - timedelta(1))
        pos = next(r for r in rows if r['data'] == d)
        diff = abs(float(pre['preco_ajustado']) - float(pos['preco_ajustado']))
        assert diff / float(pos['preco_ajustado']) < 0.0001, \
            f"Descontinuidade: {pre['preco_ajustado']} vs {pos['preco_ajustado']}"


def test_grupamento_preco_continuo():
    """Grupamento 10:1 (fator=0.1): série contínua."""
    ticker, d = 'TST002', date(2020, 8, 1)
    cotacoes = [(d - timedelta(1), 1.50), (d, 15.00)]
    eventos = [{'tipo': 'GRUPAMENTO', 'ticker': ticker, 'data_efetiva': d, 'fator_ajuste': 0.1}]
    with with_test_data(ticker, cotacoes, eventos):
        rows = query_view(ticker)
        pre = next(r for r in rows if r['data'] == d - timedelta(1))
        pos = next(r for r in rows if r['data'] == d)
        diff = abs(float(pre['preco_ajustado']) - float(pos['preco_ajustado']))
        assert diff / float(pos['preco_ajustado']) < 0.0001


def test_sem_evento_sem_ajuste():
    """Sem eventos: preco_ajustado = preco_bruto, fator_divisor = 1."""
    ticker = 'TST003'
    cotacoes = [(date(2020, 1, i + 1), 10.0 + i) for i in range(10)]
    with with_test_data(ticker, cotacoes, []):
        rows = query_view(ticker)
        for r in rows:
            assert float(r['fator_divisor']) == 1.0
            assert float(r['preco_ajustado']) == float(r['preco_bruto'])


def test_semantica_data_efetiva():
    """data_efetiva = D: cotação de D-1 recebe fator, cotação de D não recebe."""
    ticker, d = 'TST004', date(2020, 9, 10)
    cotacoes = [(d - timedelta(1), 40.0), (d, 10.0)]
    eventos = [{'tipo': 'SPLIT', 'ticker': ticker, 'data_efetiva': d, 'fator_ajuste': 4.0}]
    with with_test_data(ticker, cotacoes, eventos):
        rows = query_view(ticker)
        pre = next(r for r in rows if r['data'] == d - timedelta(1))
        pos = next(r for r in rows if r['data'] == d)
        assert float(pre['fator_divisor']) == 4.0, "D-1 deve ter fator 4"
        assert float(pos['fator_divisor']) == 1.0, "D não deve ter fator (já é preço pós-split)"


def test_dois_splits_sequenciais():
    """Dois splits: fator_divisor acumulado = produto dos dois fatores."""
    ticker = 'TST005'
    d1, d2 = date(2015, 1, 10), date(2018, 3, 15)
    cotacoes = [(date(2014, 12, 31), 60.0), (d1, 30.0), (d2, 10.0), (date(2019, 1, 1), 10.0)]
    eventos = [
        {'tipo': 'SPLIT', 'ticker': ticker, 'data_efetiva': d1, 'fator_ajuste': 2.0},
        {'tipo': 'SPLIT', 'ticker': ticker, 'data_efetiva': d2, 'fator_ajuste': 3.0},
    ]
    with with_test_data(ticker, cotacoes, eventos):
        rows = query_view(ticker)
        pre_d1 = next(r for r in rows if r['data'] == date(2014, 12, 31))
        assert abs(float(pre_d1['fator_divisor']) - 6.0) < 0.001, \
            f"Fator acumulado esperado 6.0, obtido {pre_d1['fator_divisor']}"


def test_confiabilidade_alta():
    """data >= 2010-01-01 retorna confiabilidade = 'alta'."""
    ticker = 'TST006'
    with with_test_data(ticker, [(date(2010, 1, 1), 10.0)], []):
        rows = query_view(ticker)
        assert rows[0]['confiabilidade'] == 'alta'


def test_confiabilidade_baixa():
    """data < 2010-01-01 retorna confiabilidade = 'baixa'."""
    ticker = 'TST007'
    with with_test_data(ticker, [(date(2009, 12, 31), 10.0)], []):
        rows = query_view(ticker)
        assert rows[0]['confiabilidade'] == 'baixa'


def test_evento_pos2010_ajusta_pre2010():
    """Split em 2015 deve ajustar cotação de 2008."""
    ticker = 'TST008'
    d_cot = date(2008, 6, 1)
    d_split = date(2015, 1, 10)
    cotacoes = [(d_cot, 40.0), (d_split, 10.0)]
    eventos = [{'tipo': 'SPLIT', 'ticker': ticker, 'data_efetiva': d_split, 'fator_ajuste': 4.0}]
    with with_test_data(ticker, cotacoes, eventos):
        rows = query_view(ticker)
        pre_2010 = next(r for r in rows if r['data'] == d_cot)
        assert float(pre_2010['fator_divisor']) == 4.0, \
            "Split de 2015 deve ajustar cotação de 2008 (serie comparável)"
        assert pre_2010['confiabilidade'] == 'baixa', \
            "Mas confiabilidade ainda baixa (podem faltar eventos pré-2010)"
