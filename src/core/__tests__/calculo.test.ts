import {
  calcularTotalTransacao,
  calcularPrecoMedio,
  calcularValorMercado,
  calcularPnL,
  calcularCarteira,
} from '../calculo'
import type { Transacao } from '../types'
import transacoesFixture from './fixtures/transacoes.json'

const transacoes = transacoesFixture as Transacao[]

// --- helpers ---

const itsa4fTxs = transacoes.filter((t) => t.ativoTicker === 'ITSA4F')
const bbas3Txs  = transacoes.filter((t) => t.ativoTicker === 'BBAS3')
const hglg11Txs = transacoes.filter((t) => t.ativoTicker === 'HGLG11')

// ITSA4F expected:
//   total cost = 9.07*22 + 9.00*11 = 199.54 + 99.00 = 298.54
//   total qty  = 22 + 11 = 33
//   precoMedio = 298.54 / 33 = 9.04666... (6 repeating)
const ITSA4F_PRECO_MEDIO = 298.54 / 33  // ≈ 9.0467

describe('calcularTotalTransacao', () => {
  it('multiplies valorUnitario by quantidade exactly', () => {
    expect(calcularTotalTransacao('9.07', 22)).toBe('199.54')
  })

  it('returns integer string when result has no fractional part', () => {
    expect(calcularTotalTransacao('9.00', 11)).toBe('99')
  })

  it('handles larger values', () => {
    expect(calcularTotalTransacao('163.50', 3)).toBe('490.5')
  })
})

describe('calcularPrecoMedio', () => {
  it('returns "0" for empty array', () => {
    expect(calcularPrecoMedio([])).toBe('0')
  })

  it('returns the valorUnitario itself for a single transaction', () => {
    // BBAS3: single transaction at 54.20, qty 5 → precoMedio = 54.2
    const result = calcularPrecoMedio(bbas3Txs)
    expect(parseFloat(result)).toBeCloseTo(54.2, 4)
  })

  it('computes weighted average for ITSA4F (two transactions)', () => {
    // (9.07*22 + 9.00*11) / 33 = 298.54 / 33 ≈ 9.0467
    const result = calcularPrecoMedio(itsa4fTxs)
    expect(parseFloat(result)).toBeCloseTo(ITSA4F_PRECO_MEDIO, 4)
  })

  it('gives more weight to the larger quantity position', () => {
    // qty=22 of 9.07 dominates over qty=11 of 9.00 → result closer to 9.07 than 9.00
    const result = parseFloat(calcularPrecoMedio(itsa4fTxs))
    expect(result).toBeGreaterThan(9.04)
    expect(result).toBeLessThan(9.07)
  })
})

describe('calcularValorMercado', () => {
  it('computes market value as precoFechamento × quantidadeTotal', () => {
    expect(calcularValorMercado('10.50', 33)).toBe('346.5')
  })

  it('handles FII market value', () => {
    // HGLG11: 163.50 × 3 = 490.5
    expect(calcularValorMercado('163.50', 3)).toBe('490.5')
  })
})

describe('calcularPnL', () => {
  it('returns positive pnl when precoFechamento > precoMedio', () => {
    // ITSA4F: (10.50 - precoMedio) * 33 = 10.50*33 - 298.54 = 346.5 - 298.54 = 47.96
    const precoMedioStr = calcularPrecoMedio(itsa4fTxs)
    const pnl = calcularPnL('10.50', precoMedioStr, 33)
    expect(parseFloat(pnl)).toBeCloseTo(47.96, 2)
  })

  it('returns negative pnl when precoFechamento < precoMedio', () => {
    // ITSA4F at close=8.00: (8.00 - precoMedio) * 33 = 8.00*33 - 298.54 = 264 - 298.54 = -34.54
    const precoMedioStr = calcularPrecoMedio(itsa4fTxs)
    const pnl = calcularPnL('8.00', precoMedioStr, 33)
    expect(parseFloat(pnl)).toBeCloseTo(-34.54, 2)
  })

  it('returns "0" for breakeven (precoFechamento equals precoMedio)', () => {
    const precoMedioStr = calcularPrecoMedio(itsa4fTxs)
    const pnl = calcularPnL(precoMedioStr, precoMedioStr, 33)
    expect(parseFloat(pnl)).toBeCloseTo(0, 10)
  })
})

describe('calcularCarteira', () => {
  it('returns one ResultadoAtivo per distinct ativoTicker', () => {
    const result = calcularCarteira(transacoes, {})
    const tickers = result.map((r) => r.ticker).sort()
    expect(tickers).toEqual(['BBAS3', 'HGLG11', 'ITSA4F', 'MXRF11'])
  })

  it('computes correct values for ITSA4F with cotacao', () => {
    const cotacoes = { ITSA4: '10.50', BBAS3: '58.00' }
    const result = calcularCarteira(transacoes, cotacoes)
    const itsa4f = result.find((r) => r.ticker === 'ITSA4F')!

    expect(itsa4f).toBeDefined()
    expect(itsa4f.tickerCotacao).toBe('ITSA4')
    expect(itsa4f.tipo).toBe('ACAO')
    expect(itsa4f.quantidadeTotal).toBe(33)
    expect(parseFloat(itsa4f.precoMedio)).toBeCloseTo(ITSA4F_PRECO_MEDIO, 4)
    expect(parseFloat(itsa4f.valorInvestido)).toBeCloseTo(298.54, 2)
    expect(parseFloat(itsa4f.valorMercado)).toBeCloseTo(346.5, 2)
    expect(parseFloat(itsa4f.pnl)).toBeCloseTo(47.96, 2)
    expect(parseFloat(itsa4f.pnlPercent)).toBeGreaterThan(0) // positive pnl%
  })

  it('computes correct values for BBAS3 with cotacao', () => {
    const cotacoes = { ITSA4: '10.50', BBAS3: '58.00' }
    const result = calcularCarteira(transacoes, cotacoes)
    const bbas3 = result.find((r) => r.ticker === 'BBAS3')!

    expect(bbas3).toBeDefined()
    expect(bbas3.quantidadeTotal).toBe(5)
    expect(parseFloat(bbas3.precoMedio)).toBeCloseTo(54.2, 4)
    expect(parseFloat(bbas3.valorInvestido)).toBeCloseTo(271, 2)
    expect(parseFloat(bbas3.valorMercado)).toBeCloseTo(290, 2)
    expect(parseFloat(bbas3.pnl)).toBeCloseTo(19, 2)
  })

  it('sets valorMercado and pnl to "0" for asset with no cotacao', () => {
    // Only ITSA4 is in cotacoes; HGLG11 has no entry
    const cotacoes = { ITSA4: '10.50' }
    const result = calcularCarteira(transacoes, cotacoes)
    const hglg11 = result.find((r) => r.ticker === 'HGLG11')!

    expect(hglg11).toBeDefined()
    expect(hglg11.valorMercado).toBe('0')
    expect(hglg11.pnl).toBe('0')
    expect(hglg11.pnlPercent).toBe('0')
  })

  it('still includes assets with no cotacao in the result', () => {
    const result = calcularCarteira(hglg11Txs, {})
    expect(result).toHaveLength(1)
    expect(result[0].ticker).toBe('HGLG11')
    expect(result[0].quantidadeTotal).toBe(3)
    expect(parseFloat(result[0].precoMedio)).toBeCloseTo(163.5, 4)
  })

  it('não lança erro e zera valorMercado quando cotacoesMap está vazio', () => {
    const result = calcularCarteira(hglg11Txs, {})
    expect(result[0].valorMercado).toBe('0')
    expect(result[0].pnl).toBe('0')
    expect(result[0].pnlPercent).toBe('0')
  })
})
