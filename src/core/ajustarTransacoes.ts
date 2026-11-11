import Decimal from 'decimal.js'
import type { Transacao } from './types'

export type TipoEventoAjuste = 'SPLIT' | 'GRUPAMENTO' | 'BONIFICACAO'

export interface EventoAjuste {
  ticker: string
  data_efetiva: string
  fator_ajuste: string | number | null
  tipo: TipoEventoAjuste
}

export const AVISO_PRE_2010 =
  'P&L inclui transações anteriores a 2010. Eventos corporativos desse período podem não estar refletidos.'

export const AVISO_CSV_PRE_2010 =
  'Eventos corporativos entre a compra e 2010 não considerados.'

/**
 * Fator acumulado por transação: produto de `fator_ajuste` dos eventos do mesmo
 * ticker com `data_efetiva` estritamente posterior à data da transação.
 * Transações com ajuste manual recebem fator 1.
 */
export function fatoresPorTransacao(
  transacoes: Transacao[],
  eventos: EventoAjuste[],
): Map<string, number> {
  const fatores = new Map<string, number>()

  for (const tx of transacoes) {
    if (tx.ajustadaManualmente) {
      fatores.set(tx.id, 1)
      continue
    }

    let fator = new Decimal(1)
    for (const ev of eventos) {
      if (ev.ticker !== tx.ativoTicker && ev.ticker !== tx.tickerCotacao) continue
      if (ev.data_efetiva <= tx.data) continue
      if (ev.fator_ajuste === null || ev.fator_ajuste === undefined) continue

      let valor: Decimal
      try {
        valor = new Decimal(ev.fator_ajuste)
      } catch {
        continue
      }
      if (!valor.isFinite() || valor.lte(0)) continue
      fator = fator.mul(valor)
    }
    fatores.set(tx.id, fator.toNumber())
  }

  return fatores
}

export interface TransacaoAjustada extends Transacao {
  fatorAcumulado: number
  quantidadeAjustada: number
  valorUnitarioAjustado: string
  avisoConfiabilidade: string | null
}

/**
 * Aplica os fatores de eventos corporativos para exibição.
 * O valor investido original (quantidade × valorUnitario) não muda.
 */
export function ajustarTransacoes(
  transacoes: Transacao[],
  eventos: EventoAjuste[],
): TransacaoAjustada[] {
  const fatores = fatoresPorTransacao(transacoes, eventos)

  return transacoes.map((tx) => {
    const fator = fatores.get(tx.id) ?? 1
    return {
      ...tx,
      fatorAcumulado: fator,
      quantidadeAjustada: Math.round(tx.quantidade * fator),
      valorUnitarioAjustado: new Decimal(tx.valorUnitario)
        .div(fator)
        .toDecimalPlaces(6)
        .toString(),
      avisoConfiabilidade: tx.data < '2010-01-01' ? AVISO_PRE_2010 : null,
    }
  })
}
