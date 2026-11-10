import Decimal from 'decimal.js'
import type { Transacao, ResultadoAtivo } from './types'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Total cost of a single transaction.
 */
export function calcularTotalTransacao(valorUnitario: string, quantidade: number): string {
  return new Decimal(valorUnitario).mul(new Decimal(quantidade)).toString()
}

/**
 * Weighted average price across all transactions of ONE asset.
 * When `fatores` is provided, the quantity of each transaction is adjusted by
 * its accumulated corporate-event factor, so the average price reflects the
 * post-event share basis. Returns "0" if transacoes is empty.
 */
export function calcularPrecoMedio(
  transacoes: Transacao[],
  fatores?: Map<string, number>,
): string {
  if (transacoes.length === 0) {
    return '0'
  }

  let totalCost = new Decimal(0)
  let totalQuantity = new Decimal(0)

  for (const t of transacoes) {
    const fator = fatores?.get(t.id) ?? 1
    const cost = new Decimal(t.valorUnitario).mul(new Decimal(t.quantidade))
    totalCost = totalCost.plus(cost)
    totalQuantity = totalQuantity.plus(new Decimal(Math.round(t.quantidade * fator)))
  }

  if (totalQuantity.isZero()) {
    return '0'
  }

  return totalCost.div(totalQuantity).toString()
}

/**
 * Current market value of a position.
 * `quantidadeTotal` must already include corporate-event adjustments.
 */
export function calcularValorMercado(precoFechamento: string, quantidadeTotal: number): string {
  return new Decimal(precoFechamento).mul(new Decimal(quantidadeTotal)).toString()
}

/**
 * Absolute P&L for a position.
 * pnl = (precoFechamento - precoMedio) * quantidadeTotal
 * `precoMedio` and `quantidadeTotal` must already include corporate-event adjustments.
 */
export function calcularPnL(precoFechamento: string, precoMedio: string, quantidadeTotal: number): string {
  return new Decimal(precoFechamento)
    .minus(new Decimal(precoMedio))
    .mul(new Decimal(quantidadeTotal))
    .toString()
}

/**
 * Aggregate all transactions by asset ticker, returning one ResultadoAtivo per asset.
 * Pass cotacoes map (ticker → precoFechamento string) for market value computation.
 * When `fatores` is provided, each transaction's quantity is adjusted by its
 * accumulated corporate-event factor; valorInvestido keeps the original cost.
 * Assets with no matching cotacao still appear; their valorMercado and pnl are "0".
 */
export function calcularCarteira(
  transacoes: Transacao[],
  cotacoes: Record<string, string>,
  fatores?: Map<string, number>,
): ResultadoAtivo[] {
  // Group transactions by ativoTicker
  const grouped = new Map<string, Transacao[]>()

  for (const t of transacoes) {
    const existing = grouped.get(t.ativoTicker)
    if (existing) {
      existing.push(t)
    } else {
      grouped.set(t.ativoTicker, [t])
    }
  }

  const resultados: ResultadoAtivo[] = []

  for (const [ticker, txs] of grouped) {
    const firstTx = txs[0]
    const tickerCotacao = firstTx.tickerCotacao
    const tipo = firstTx.tipo

    const quantidadeTotal = txs.reduce(
      (sum, t) => sum + Math.round(t.quantidade * (fatores?.get(t.id) ?? 1)),
      0,
    )
    const precoMedio = calcularPrecoMedio(txs, fatores)
    const valorInvestido = new Decimal(precoMedio).mul(new Decimal(quantidadeTotal)).toString()

    const precoFechamento = cotacoes[tickerCotacao]

    let valorMercado = '0'
    let pnl = '0'
    let pnlPercent = '0'

    if (precoFechamento !== undefined) {
      valorMercado = calcularValorMercado(precoFechamento, quantidadeTotal)
      pnl = calcularPnL(precoFechamento, precoMedio, quantidadeTotal)

      const valorInvestidoDecimal = new Decimal(valorInvestido)
      if (!valorInvestidoDecimal.isZero()) {
        pnlPercent = new Decimal(pnl).div(valorInvestidoDecimal).mul(new Decimal(100)).toString()
      }
    }

    resultados.push({
      ticker,
      tickerCotacao,
      tipo,
      quantidadeTotal,
      precoMedio,
      valorInvestido,
      valorMercado,
      pnl,
      pnlPercent,
    })
  }

  return resultados
}
