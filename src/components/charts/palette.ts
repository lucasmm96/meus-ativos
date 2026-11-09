export const TICKER_PALETTE = [
  '#6cba3b', // green  (posição 0 — BBAS3 no alfabeto dos 11 tickers)
  '#4285f4', // blue   (posição 1 — BBSE3)
  '#f4a842', // amber  (posição 2 — HGLG11)
  '#e05c5c', // rose   (posição 3 — ITSA4)
  '#a855f7', // purple (posição 4 — MXRF11)
  '#14b8a6', // teal   (posição 5 — PETR4)
  '#f59e0b', // yellow (posição 6 — PVBI11)
  '#06b6d4', // cyan   (posição 7 — RBRP11)
  '#ec4899', // pink   (posição 8 — TAEE11)
  '#84cc16', // lime   (posição 9 — VALE3)
  '#f97316', // orange (posição 10 — XPML11)
  '#8b5cf6', // violet (reserva)
]

/**
 * Retorna cor estável por ticker.
 * sortedTickers: todos os tickers do portfólio ordenados alfabeticamente.
 * Cor atribuída por posição — não muda entre renders ou adições de outros ativos.
 */
export function tickerColor(sortedTickers: string[], ticker: string): string {
  const idx = sortedTickers.indexOf(ticker)
  return TICKER_PALETTE[(idx < 0 ? 0 : idx) % TICKER_PALETTE.length]
}
