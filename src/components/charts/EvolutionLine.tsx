import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ChartCard } from '../ChartCard'

interface DataPoint { date: string; total: number }
type Period = '1M' | '6M' | '1A' | 'Tudo'

interface Props { data: DataPoint[] }

export function EvolutionLine({ data }: Props) {
  const [period, setPeriod] = useState<Period>('6M')

  const filtered = (() => {
    if (period === 'Tudo') return data
    const now = new Date()
    const months = period === '1M' ? 1 : period === '6M' ? 6 : 12
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
    return data.filter(d => new Date(d.date) >= cutoff)
  })()

  return (
    <ChartCard title="Evolução Patrimonial">
      <div className="flex gap-2 mb-4">
        {(['1M', '6M', '1A', 'Tudo'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-xs font-body font-medium transition-colors
              ${period === p ? 'bg-equity text-bg-base' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}
          >
            {p}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
          <XAxis dataKey="date" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
          <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
          <Line type="monotone" dataKey="total" stroke="#6cba3b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
