import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Confiabilidade } from '../../core/ativoHistorico'
import { ChartCard } from '../ChartCard'

interface DataPoint {
  date: string
  total: number
  confiabilidade: Confiabilidade
}
type Period = '1M' | '6M' | '1A' | 'Tudo'

interface Props { data: DataPoint[] }

const COR_ALTA = '#6cba3b'
const COR_BAIXA = '#8a8a8a'
const COR_CORTE = '#a0a0a0'

function timestampDeIso(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime()
}

function formatarEixoX(timestamp: number, dias: number): string {
  const data = new Date(timestamp)
  if (Number.isNaN(data.getTime())) return String(timestamp)
  if (dias <= 180) {
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  if (dias <= 730) {
    const mes = data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    const ano = String(data.getFullYear()).slice(2)
    return `${mes}/${ano}`
  }
  return String(data.getFullYear())
}

function formatarTimestamp(timestamp: number): string {
  const data = new Date(timestamp)
  if (Number.isNaN(data.getTime())) return String(timestamp)
  return data.toLocaleDateString('pt-BR')
}

export function EvolutionLine({ data }: Props) {
  const [period, setPeriod] = useState<Period>('6M')

  const filtered = (() => {
    if (period === 'Tudo') return data
    const now = new Date()
    const months = period === '1M' ? 1 : period === '6M' ? 6 : 12
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
    return data.filter(d => new Date(d.date) >= cutoff)
  })()

  const temPre2010 = filtered.some(d => d.confiabilidade === 'baixa')
  const mostrarCorte2010 =
    filtered.length > 0 &&
    filtered[0].date <= '2010-01-01' &&
    filtered[filtered.length - 1].date >= '2010-01-01'

  const diasSerie =
    filtered.length > 1
      ? Math.max(
          1,
          Math.round(
            (timestampDeIso(filtered[filtered.length - 1].date) -
              timestampDeIso(filtered[0].date)) /
              86_400_000,
          ),
        )
      : 1

  const chartData = filtered.map(d => ({
    ...d,
    timestamp: timestampDeIso(d.date),
    totalAlta: d.confiabilidade === 'alta' ? d.total : null,
    totalBaixa: d.confiabilidade === 'baixa' ? d.total : null,
  }))

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
        <LineChart
          data={chartData}
          margin={mostrarCorte2010 ? { top: 24, right: 8, bottom: 0, left: 0 } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#a0a0a0', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}
            minTickGap={100}
            tickFormatter={(valor: number) => formatarEixoX(valor, diasSerie)}
          />
          <YAxis tick={{ fill: '#a0a0a0', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }} tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            labelFormatter={(label) => formatarTimestamp(Number(label))}
          />
          {temPre2010 && (
            <Line
              type="monotone"
              dataKey="totalBaixa"
              name="Pré-2010 (confiabilidade baixa)"
              stroke={COR_BAIXA}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey={temPre2010 ? 'totalAlta' : 'total'}
            name={temPre2010 ? 'Pós-2010 (confiabilidade alta)' : undefined}
            stroke={COR_ALTA}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {mostrarCorte2010 && (
            <ReferenceLine
              x={timestampDeIso('2010-01-01')}
              stroke={COR_CORTE}
              strokeDasharray="3 3"
              label={{
                value: 'Início da série ajustada',
                position: 'insideTopLeft',
                fill: COR_CORTE,
                fontSize: 10,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
