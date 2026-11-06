import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { ResultadoAtivo } from '../../core/types'
import { ChartCard } from '../ChartCard'

const COLORS: Record<string, string> = { ACAO: '#6cba3b', FII: '#4285f4' }

interface Props { resultados: ResultadoAtivo[]; mode: 'valor' | 'cotas' }

export function AllocationBar({ resultados, mode }: Props) {
  const sorted = [...resultados].sort((a, b) =>
    mode === 'valor'
      ? parseFloat(b.valorInvestido) - parseFloat(a.valorInvestido)
      : b.quantidadeTotal - a.quantidadeTotal
  )
  const data = sorted.map(r => ({
    ticker: r.ticker,
    value: mode === 'valor' ? parseFloat(r.valorInvestido) : r.quantidadeTotal,
    tipo: r.tipo,
  }))

  if (mode === 'valor') {
    // Horizontal bar chart
    return (
      <ChartCard title="Valor por Ativo">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <XAxis type="number" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
            <YAxis dataKey="ticker" type="category" tick={{ fill: '#a0a0a0', fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <Bar dataKey="value">
              {data.map((entry, i) => <Cell key={i} fill={COLORS[entry.tipo]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    )
  }

  // Vertical bar chart
  return (
    <ChartCard title="Cotas por Ativo">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="ticker" tick={{ fill: '#a0a0a0', fontSize: 11 }} />
          <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} />
          <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
          <Bar dataKey="value">
            {data.map((entry, i) => <Cell key={i} fill={COLORS[entry.tipo]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
