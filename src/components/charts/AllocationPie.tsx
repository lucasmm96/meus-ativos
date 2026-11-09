import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ResultadoAtivo } from '../../core/types'
import { ChartCard } from '../ChartCard'
import { tickerColor } from './palette'

interface Props { resultados: ResultadoAtivo[]; mode: 'valor' | 'cotas' }

export function AllocationPie({ resultados, mode }: Props) {
  const sortedTickers = [...resultados].map(r => r.ticker).sort()
  const data = resultados.map(r => ({
    name: r.ticker,
    value: mode === 'valor' ? parseFloat(r.valorInvestido) : r.quantidadeTotal,
  }))

  return (
    <ChartCard title={mode === 'valor' ? 'Alocação — Valor' : 'Alocação — Cotas'}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={90}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={tickerColor(sortedTickers, entry.name)} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
