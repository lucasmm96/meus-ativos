import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { ResultadoAtivo } from '../../core/types'
import { ChartCard } from '../ChartCard'
import { tickerColor } from './palette'

interface Props { resultados: ResultadoAtivo[]; mode: 'valor' | 'cotas' }

interface TickerTickProps {
  x?: number
  y?: number
  payload?: { value?: string }
  navigate: (to: string) => void
}

function TickerTick({ x, y, payload, navigate }: TickerTickProps) {
  if (x == null || y == null || !payload?.value) return null
  const ticker = payload.value
  return (
    <a
      href={`/ativos/${ticker}`}
      onClick={(event) => {
        event.preventDefault()
        navigate(`/ativos/${ticker}`)
      }}
      aria-label={`Abrir histórico de ${ticker}`}
    >
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill="#a0a0a0"
        fontSize={11}
        style={{ cursor: 'pointer' }}
      >
        {ticker}
      </text>
    </a>
  )
}


export function AllocationBar({ resultados, mode }: Props) {
  const navigate = useNavigate()
  const sortedTickers = [...resultados].map(r => r.tickerCotacao).sort()
  const sorted = [...resultados].sort((a, b) =>
    mode === 'valor'
      ? parseFloat(b.valorInvestido) - parseFloat(a.valorInvestido)
      : b.quantidadeTotal - a.quantidadeTotal
  )
  const data = sorted.map(r => ({
    ticker: r.tickerCotacao,
    value: mode === 'valor' ? parseFloat(r.valorInvestido) : r.quantidadeTotal,
  }))

  if (mode === 'valor') {
    return (
      <ChartCard title="Valor por Ativo">
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32 + 60)}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
            <XAxis type="number" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
            <YAxis
              dataKey="ticker"
              type="category"
              tick={<TickerTick navigate={navigate} />}
              width={76}
            />
            <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <Bar dataKey="value">
              {data.map((entry, i) => (
                <Cell key={i} fill={tickerColor(sortedTickers, entry.ticker)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Cotas por Ativo">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32 + 60)}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
          <XAxis type="number" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
          <YAxis
            dataKey="ticker"
            type="category"
            tick={<TickerTick navigate={navigate} />}
            width={76}
          />
          <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
          <Bar dataKey="value">
            {data.map((entry, i) => (
              <Cell key={i} fill={tickerColor(sortedTickers, entry.ticker)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
