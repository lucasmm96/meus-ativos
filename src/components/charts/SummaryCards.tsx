import type { ResultadoAtivo } from '../../core/types'
import { Card } from '../Card'
import Decimal from 'decimal.js'

interface Props { resultados: ResultadoAtivo[] }

function fmt(val: string) {
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mercadoOuInvestido(r: ResultadoAtivo): Decimal {
  return parseFloat(r.valorMercado) > 0
    ? new Decimal(r.valorMercado)
    : new Decimal(r.valorInvestido)
}

export function SummaryCards({ resultados }: Props) {
  const totalAcoes = resultados
    .filter(r => r.tipo === 'ACAO')
    .reduce((s, r) => s.plus(mercadoOuInvestido(r)), new Decimal(0))
  const totalFiis = resultados
    .filter(r => r.tipo === 'FII')
    .reduce((s, r) => s.plus(mercadoOuInvestido(r)), new Decimal(0))
  const total = totalAcoes.plus(totalFiis)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">Ações — Mercado</p>
        <p className="text-equity font-body text-xl font-semibold tabular-nums">{fmt(totalAcoes.toString())}</p>
      </Card>
      <Card>
        <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">FIIs — Mercado</p>
        <p className="text-yield font-body text-xl font-semibold tabular-nums">{fmt(totalFiis.toString())}</p>
      </Card>
      <Card>
        <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">Total — Mercado</p>
        <p className="text-text-primary font-body text-xl font-semibold tabular-nums">{fmt(total.toString())}</p>
      </Card>
    </div>
  )
}
