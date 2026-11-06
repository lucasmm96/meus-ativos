import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ResultadoAtivo } from '../../core/types'
import { ChartCard } from '../ChartCard'

const COLORS: Record<string, string> = { ACAO: '#6cba3b', FII: '#4285f4' }

interface Props { resultados: ResultadoAtivo[]; mode: 'valor' | 'cotas' }

export function AllocationPie({ resultados, mode }: Props) {
  const data = resultados.map(r => ({
    name: r.ticker,
    value: mode === 'valor' ? parseFloat(r.valorInvestido) : r.quantidadeTotal,
    tipo: r.tipo,
  }))

  return (
    <ChartCard title={mode === 'valor' ? 'Alocação — Valor' : 'Alocação — Cotas'}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }: { name: string }) => name}>
            {data.map((entry, i) => (
              <Cell key={i} fill={COLORS[entry.tipo]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
