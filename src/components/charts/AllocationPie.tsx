import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ResultadoAtivo } from '../../core/types'
import { ChartCard } from '../ChartCard'
import { tickerColor } from './palette'

interface Props { resultados: ResultadoAtivo[]; mode: 'valor' | 'cotas' }

export function AllocationPie({ resultados, mode }: Props) {
  const sortedTickers = [...resultados].map(r => r.tickerCotacao).sort()
  const data = resultados.map(r => ({
    name: r.tickerCotacao,
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
            cy="42%"
            outerRadius={90}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={tickerColor(sortedTickers, entry.name)} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
          <Legend
            content={() => (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {data.map((entry) => (
                  <Link
                    key={entry.name}
                    to={`/ativos/${entry.name}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-elevated hover:bg-surface-card font-body text-xs text-text-secondary hover:text-text-primary transition-colors"
                    aria-label={`Abrir histórico de ${entry.name}`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: tickerColor(sortedTickers, entry.name) }}
                    />
                    {entry.name}
                  </Link>
                ))}
              </div>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
