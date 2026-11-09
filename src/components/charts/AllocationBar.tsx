import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { ResultadoAtivo } from '../../core/types'
import { ChartCard } from '../ChartCard'
import { tickerColor } from './palette'

interface Props { resultados: ResultadoAtivo[]; mode: 'valor' | 'cotas' }

export function AllocationBar({ resultados, mode }: Props) {
  const sortedTickers = [...resultados].map(r => r.ticker).sort()
  const sorted = [...resultados].sort((a, b) =>
    mode === 'valor'
      ? parseFloat(b.valorInvestido) - parseFloat(a.valorInvestido)
      : b.quantidadeTotal - a.quantidadeTotal
  )
  const data = sorted.map(r => ({
    ticker: r.ticker,
    value: mode === 'valor' ? parseFloat(r.valorInvestido) : r.quantidadeTotal,
  }))

  if (mode === 'valor') {
    return (
      <ChartCard title="Valor por Ativo">
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32 + 60)}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
            <XAxis type="number" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
            <YAxis dataKey="ticker" type="category" tick={{ fill: '#a0a0a0', fontSize: 11 }} width={70} />
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
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
          <XAxis
            dataKey="ticker"
            tick={{ fill: '#a0a0a0', fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} />
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
