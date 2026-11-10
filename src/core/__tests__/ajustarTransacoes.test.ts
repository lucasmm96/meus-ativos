import {
  ajustarTransacoes,
  fatoresPorTransacao,
  AVISO_PRE_2010,
  type EventoAjuste,
} from '../ajustarTransacoes'
import { calcularCarteira, calcularPrecoMedio } from '../calculo'
import { montarEvolucaoPatrimonial } from '../cotacoes'
import type { CotacaoAjustada } from '../ativoHistorico'
import type { Transacao } from '../types'

function transacao(overrides: Partial<Transacao> = {}): Transacao {
  return {
    id: 'tx-1',
    userId: 'user-1',
    ativoTicker: 'BBAS3',
    tickerCotacao: 'BBAS3',
    tipo: 'ACAO',
    data: '2023-01-02',
    valorUnitario: '25',
    quantidade: 100,
    ...overrides,
  }
}

function evento(overrides: Partial<EventoAjuste> = {}): EventoAjuste {
  return {
    ticker: 'BBAS3',
    data_efetiva: '2024-04-16',
    fator_ajuste: '2',
    tipo: 'SPLIT',
    ...overrides,
  }
}

function cotacao(
  data: string,
  precoAjustado: string,
  ativoTicker = 'BBAS3',
): CotacaoAjustada {
  return {
    ativoTicker,
    data,
    preco_bruto: precoAjustado,
    preco_ajustado: precoAjustado,
    fator_divisor: '1',
    confiabilidade: 'alta',
  }
}

describe('fatoresPorTransacao', () => {
  it('aplica o fator de um evento posterior à transação', () => {
    const fatores = fatoresPorTransacao([transacao()], [evento()])
    expect(fatores.get('tx-1')).toBe(2)
  })

  it('não aplica fator quando a transação é posterior ao evento', () => {
    const fatores = fatoresPorTransacao(
      [transacao({ data: '2024-04-17' })],
      [evento()],
    )
    expect(fatores.get('tx-1')).toBe(1)
  })

  it('acumula dois eventos sequenciais pelo produto dos fatores', () => {
    const eventos = [
      evento({ data_efetiva: '2024-04-16', fator_ajuste: '2' }),
      evento({ data_efetiva: '2025-04-16', fator_ajuste: '2' }),
    ]
    const fatores = fatoresPorTransacao([transacao()], eventos)
    expect(fatores.get('tx-1')).toBe(4)
  })

  it('não aplica evento na mesma data da transação (comparação estrita)', () => {
    const fatores = fatoresPorTransacao(
      [transacao({ data: '2024-04-16' })],
      [evento({ data_efetiva: '2024-04-16' })],
    )
    expect(fatores.get('tx-1')).toBe(1)
  })

  it('retorna fator 1 para transação marcada como ajustada manualmente', () => {
    const fatores = fatoresPorTransacao(
      [transacao({ ajustadaManualmente: true })],
      [evento()],
    )
    expect(fatores.get('tx-1')).toBe(1)
  })

  it('retorna fator 1 quando não há eventos', () => {
    const txs = [transacao({ id: 'a' }), transacao({ id: 'b' })]
    const fatores = fatoresPorTransacao(txs, [])
    expect(fatores.get('a')).toBe(1)
    expect(fatores.get('b')).toBe(1)
  })

  it('ignora eventos de outro ticker', () => {
    const fatores = fatoresPorTransacao(
      [transacao()],
      [evento({ ticker: 'ITSA4' })],
    )
    expect(fatores.get('tx-1')).toBe(1)
  })

  it('ignora eventos sem fator válido', () => {
    const fatores = fatoresPorTransacao(
      [transacao()],
      [
        evento({ fator_ajuste: null }),
        evento({ fator_ajuste: '0' }),
        evento({ fator_ajuste: 'abc' }),
      ],
    )
    expect(fatores.get('tx-1')).toBe(1)
  })
})

describe('ajustarTransacoes', () => {
  it('exibe quantidade ajustada e preço unitário dividido pelo fator', () => {
    const [result] = ajustarTransacoes([transacao()], [evento()])
    expect(result.fatorAcumulado).toBe(2)
    expect(result.quantidadeAjustada).toBe(200)
    expect(parseFloat(result.valorUnitarioAjustado)).toBeCloseTo(12.5, 6)
  })

  it('aplica múltiplos eventos em cascata', () => {
    const eventos = [
      evento({ data_efetiva: '2014-01-10', fator_ajuste: '2' }),
      evento({ data_efetiva: '2015-01-10', fator_ajuste: '2' }),
      evento({ data_efetiva: '2018-01-10', fator_ajuste: '1.5' }),
      evento({ data_efetiva: '2021-01-10', fator_ajuste: '2' }),
    ]
    const [result] = ajustarTransacoes(
      [transacao({ data: '2013-01-02', valorUnitario: '60' })],
      eventos,
    )
    expect(result.fatorAcumulado).toBe(12)
    expect(result.quantidadeAjustada).toBe(1200)
    expect(parseFloat(result.valorUnitarioAjustado)).toBeCloseTo(5, 6)
  })

  it('marca aviso apenas para transações pré-2010', () => {
    const [pre2010, limite] = ajustarTransacoes(
      [
        transacao({ id: 'pre', data: '2009-12-31' }),
        transacao({ id: 'limite', data: '2010-01-01' }),
      ],
      [],
    )
    expect(pre2010.avisoConfiabilidade).toBe(AVISO_PRE_2010)
    expect(limite.avisoConfiabilidade).toBeNull()
  })

  it('não ajusta quantidade de transação marcada manualmente', () => {
    const [result] = ajustarTransacoes(
      [transacao({ ajustadaManualmente: true, quantidade: 200 })],
      [evento()],
    )
    expect(result.fatorAcumulado).toBe(1)
    expect(result.quantidadeAjustada).toBe(200)
  })
})

describe('P&L com quantidade ajustada', () => {
  const txs = [transacao()]
  const eventos = [evento()]
  const fatores = fatoresPorTransacao(txs, eventos)

  it('calcula P&L usando quantidade exibida e custo original', () => {
    // 100 ações a R$25, split 2:1 → 200 ações a R$12,50.
    // Preço atual ajustado R$15 → mercado R$3000, investido R$2500, P&L R$500.
    const [result] = calcularCarteira(txs, { BBAS3: '15' }, fatores)

    expect(result.quantidadeTotal).toBe(200)
    expect(parseFloat(result.precoMedio)).toBeCloseTo(12.5, 6)
    expect(parseFloat(result.valorInvestido)).toBeCloseTo(2500, 6)
    expect(parseFloat(result.valorMercado)).toBeCloseTo(3000, 6)
    expect(parseFloat(result.pnl)).toBeCloseTo(500, 6)
    expect(parseFloat(result.pnlPercent)).toBeCloseTo(20, 6)
  })

  it('mantém o preço médio original quando não há evento', () => {
    const semEvento = [transacao()]
    const fatoresSemEvento = fatoresPorTransacao(semEvento, [])
    const [result] = calcularCarteira(semEvento, { BBAS3: '15' }, fatoresSemEvento)

    expect(result.quantidadeTotal).toBe(100)
    expect(parseFloat(result.precoMedio)).toBeCloseTo(25, 6)
    expect(parseFloat(result.valorMercado)).toBeCloseTo(1500, 6)
    expect(parseFloat(result.pnl)).toBeCloseTo(-1000, 6)
  })

  it('calcularPrecoMedio aceita fatores e divide pelo total ajustado', () => {
    expect(parseFloat(calcularPrecoMedio(txs, fatores))).toBeCloseTo(12.5, 6)
  })
})

describe('evolução patrimonial com quantidade ajustada', () => {
  it('mantém a série contínua ao redor do split', () => {
    const txs = [transacao({ tickerCotacao: 'BBAS3', data: '2023-01-02' })]
    const fatores = fatoresPorTransacao(txs, [evento()])
    const cotacoes = [
      // Antes do split: bruto 60, ajustado 30.
      cotacao('2024-04-15', '30'),
      // Depois do split: bruto 30, ajustado 30.
      cotacao('2024-04-16', '30'),
    ]

    const evolucao = montarEvolucaoPatrimonial(txs, cotacoes, fatores)

    expect(evolucao).toHaveLength(2)
    expect(evolucao[0].total).toBeCloseTo(6000, 2)
    expect(evolucao[1].total).toBeCloseTo(6000, 2)
    const variacao = evolucao[1].total / evolucao[0].total - 1
    expect(Math.abs(variacao)).toBeLessThan(0.01)
  })

  it('sem split, a série permanece idêntica ao cálculo anterior', () => {
    const txs = [transacao({ data: '2023-01-02' })]
    const evolucao = montarEvolucaoPatrimonial(
      txs,
      [cotacao('2024-01-02', '10')],
      fatoresPorTransacao(txs, []),
    )
    expect(evolucao).toEqual([
      { date: '2024-01-02', total: 1000, confiabilidade: 'alta' },
    ])
  })
})
