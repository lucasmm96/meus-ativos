import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

config({ path: '.env.local' })
const sql = neon(process.env.DATABASE_URL)

const tickers = ['ITSA4', 'BBAS3', 'TAEE11', 'BBSE3', 'VALE3', 'PETR4', 'HGLG11', 'MXRF11', 'XPML11', 'PVBI11', 'RBRP11']

async function fetchHistory(ticker) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1d&range=3mo`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
  const d = await r.json()
  const result = d?.chart?.result?.[0]
  if (!result) return []
  const timestamps = result.timestamp ?? []
  const closes = result.indicators?.quote?.[0]?.close ?? []
  const rows = []
  for (let i = 0; i < timestamps.length; i++) {
    if (!closes[i]) continue
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
    rows.push([ticker, date, closes[i].toFixed(2)])
  }
  return rows
}

const allRows = []
for (const t of tickers) {
  try {
    const rows = await fetchHistory(t)
    allRows.push(...rows)
    console.log(t, rows.length, 'pontos')
  } catch (e) {
    console.error(t, 'ERRO:', e.message)
  }
}

if (allRows.length === 0) {
  console.log('Nenhum dado para inserir')
  process.exit(1)
}

const CHUNK = 200
let inserted = 0
for (let i = 0; i < allRows.length; i += CHUNK) {
  const slice = allRows.slice(i, i + CHUNK)
  await sql`
    INSERT INTO cotacoes ("ativoTicker", data, "precoFechamento")
    SELECT * FROM unnest(
      ${slice.map(r => r[0])}::text[],
      ${slice.map(r => r[1])}::date[],
      ${slice.map(r => r[2])}::numeric[]
    ) AS t(ticker, data, preco)
    ON CONFLICT DO NOTHING
  `
  inserted += slice.length
}
console.log('Total inseridos:', inserted)
