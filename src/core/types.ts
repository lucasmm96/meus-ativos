export type TipoAtivo = 'ACAO' | 'FII'

export interface Transacao {
  id: string
  userId: string
  ativoTicker: string        // e.g. "ITSA4F" (fractional share ticker)
  tickerCotacao: string      // e.g. "ITSA4" (base ticker for price lookup)
  tipo: TipoAtivo
  data: string               // ISO date string "YYYY-MM-DD"
  valorUnitario: string      // numeric string, e.g. "9.07"
  quantidade: number
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
