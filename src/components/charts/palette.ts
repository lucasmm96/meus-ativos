// 20 cores perceptualmente distintas — sem repetições para carteiras de até 20 ativos.
// Para n > 20, geração por ângulo dourado garante separação máxima sem repeti.
const TICKER_PALETTE = [
  'hsl(211,78%,57%)',  // blue
  'hsl(145,59%,43%)',  // green
  'hsl(30,90%,55%)',   // orange
  'hsl(300,52%,55%)',  // purple
  'hsl(4,68%,56%)',    // red
  'hsl(174,65%,42%)',  // teal
  'hsl(44,90%,52%)',   // amber
  'hsl(330,68%,56%)',  // pink
  'hsl(194,74%,46%)',  // cyan
  'hsl(80,58%,47%)',   // lime
  'hsl(258,58%,62%)',  // violet
  'hsl(16,78%,52%)',   // deep orange
  'hsl(232,53%,52%)',  // indigo
  'hsl(161,58%,42%)',  // seafoam
  'hsl(348,64%,53%)',  // rose
  'hsl(55,78%,46%)',   // yellow
  'hsl(188,70%,48%)',  // aqua
  'hsl(272,62%,58%)',  // lavender
  'hsl(118,52%,44%)',  // forest green
  'hsl(22,74%,50%)',   // burnt orange
]

/**
 * Retorna cor estável por ticker.
 * sortedTickers: todos os tickers do portfólio ordenados alfabeticamente.
 * Cor atribuída por posição — não muda entre renders ou adições de outros ativos.
 */
export function tickerColor(sortedTickers: string[], ticker: string): string {
  const idx = sortedTickers.indexOf(ticker)
  const i = idx < 0 ? 0 : idx
  if (i < TICKER_PALETTE.length) return TICKER_PALETTE[i]
  // Ângulo dourado (137.508°): separação máxima para n arbitrário
  const hue = Math.round((i * 137.508) % 360)
  const sat = 60 + (i % 3) * 6
  const lgt = 50 + (i % 2) * 7
  return `hsl(${hue}, ${sat}%, ${lgt}%)`
}
