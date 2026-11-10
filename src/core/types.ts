export type TipoAtivo = 'ACAO' | 'FII'

export interface Transacao {
  id: string
  userId: string
  ativoTicker: string        // e.g. "ITSA4F" (fractional share ticker)
  tickerCotacao: string      // from ativos join (not stored in transacoes)
  tipo: TipoAtivo            // from ativos join (not stored in transacoes)
  data: string               // ISO date string "YYYY-MM-DD"
  valorUnitario: string      // numeric string, e.g. "9.07"
  quantidade: number
  /** true = usuário já ajustou manualmente; fatores automáticos não se aplicam */
  ajustadaManualmente?: boolean
}

/** Raw row from PostgREST — no join fields yet */
export interface TransacaoRow {
  id: string
  userId: string
  ativoTicker: string
  data: string
  valorUnitario: string
  quantidade: number
  ajustadaManualmente?: boolean
}

export interface ResultadoAtivo {
  ticker: string
  tickerCotacao: string
  tipo: TipoAtivo
  quantidadeTotal: number
  precoMedio: string         // numeric string, e.g. "9.07"
  valorInvestido: string     // precoMedio * quantidadeTotal
  valorMercado: string       // precoFechamento * quantidadeTotal (or "0" if no quote)
  pnl: string                // (precoFechamento - precoMedio) * quantidadeTotal (or "0")
  pnlPercent: string         // pnl / valorInvestido * 100 (or "0")
}
