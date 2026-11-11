import { useState } from 'react'
import type { ResultadoAtivo } from '../../core/types'
import { AVISO_PRE_2010 } from '../../core/ajustarTransacoes'
import { Card } from '../Card'
import Decimal from 'decimal.js'

interface Props {
  resultados: ResultadoAtivo[]
  temPre2010?: boolean
  dataAtualizacao?: string
}

function fmt(val: string) {
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(val: Decimal) {
  const prefix = val.isPositive() && !val.isZero() ? '+' : ''
  return `${prefix}${val.toFixed(2).replace('.', ',')}%`
}

function fmtSigned(val: Decimal) {
  const prefix = val.isPositive() && !val.isZero() ? '+' : ''
  return `${prefix}${fmt(val.toString())}`
}

function mercadoOuInvestido(r: ResultadoAtivo): Decimal {
  return parseFloat(r.valorMercado) > 0
    ? new Decimal(r.valorMercado)
    : new Decimal(r.valorInvestido)
}

interface PillVariacaoProps {
  pnl: Decimal
  investido: Decimal
}

function PillVariacao({ pnl, investido }: PillVariacaoProps) {
  const [aberto, setAberto] = useState(false)

  if (investido.isZero()) return null

  const pct = pnl.div(investido).mul(100)
  const positivo = !pct.isNegative()
  const colorClass = positivo ? 'bg-equity/15 text-equity' : 'bg-alert/15 text-alert'

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') setAberto(true)
  }
  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') setAberto(false)
  }

  return (
    <div className="relative inline-block">
      <span
        role="button"
        tabIndex={0}
        className={`px-2 py-0.5 rounded-full leading-none ${colorClass} font-body text-[10px] font-semibold whitespace-nowrap cursor-default select-none`}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => { e.stopPropagation(); setAberto(v => !v) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setAberto(v => !v) }}
      >
        {fmtPct(pct)}
      </span>
      {aberto && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 bg-surface-card border border-border-subtle rounded px-2 py-1 font-mono text-[11px] text-text-primary shadow-md whitespace-nowrap pointer-events-none">
          {fmtSigned(pnl)}
        </div>
      )}
    </div>
  )
}

export function SummaryCards({ resultados, temPre2010 = false, dataAtualizacao }: Props) {
  const acoes = resultados.filter(r => r.tipo === 'ACAO')
  const fiis = resultados.filter(r => r.tipo === 'FII')

  const totalAcoes = acoes.reduce((s, r) => s.plus(mercadoOuInvestido(r)), new Decimal(0))
  const totalFiis = fiis.reduce((s, r) => s.plus(mercadoOuInvestido(r)), new Decimal(0))
  const total = totalAcoes.plus(totalFiis)

  const pnlAcoes = acoes.reduce((s, r) => s.plus(r.pnl), new Decimal(0))
  const pnlFiis = fiis.reduce((s, r) => s.plus(r.pnl), new Decimal(0))
  const pnlTotal = pnlAcoes.plus(pnlFiis)

  const investidoAcoes = acoes.reduce((s, r) => s.plus(r.valorInvestido), new Decimal(0))
  const investidoFiis = fiis.reduce((s, r) => s.plus(r.valorInvestido), new Decimal(0))
  const investidoTotal = investidoAcoes.plus(investidoFiis)

  const dataFmt = dataAtualizacao
    ? new Date(`${dataAtualizacao}T00:00:00`).toLocaleDateString('pt-BR')
    : null

  return (
    <div className="space-y-1.5">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-text-secondary font-body text-xs uppercase tracking-widest">Ações — Mercado</p>
          <PillVariacao pnl={pnlAcoes} investido={investidoAcoes} />
        </div>
        <p className="text-equity font-mono text-xl font-semibold tabular-nums">{fmt(totalAcoes.toString())}</p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-text-secondary font-body text-xs uppercase tracking-widest">FIIs — Mercado</p>
          <PillVariacao pnl={pnlFiis} investido={investidoFiis} />
        </div>
        <p className="text-yield font-mono text-xl font-semibold tabular-nums">{fmt(totalFiis.toString())}</p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-text-secondary font-body text-xs uppercase tracking-widest">Total — Mercado</p>
          <PillVariacao pnl={pnlTotal} investido={investidoTotal} />
        </div>
        <p className="text-text-primary font-mono text-xl font-semibold tabular-nums">{fmt(total.toString())}</p>
        {temPre2010 && (
          <p className="text-yield font-body text-[11px] leading-snug mt-1" role="status">
            {AVISO_PRE_2010}
          </p>
        )}
      </Card>
    </div>
    {dataFmt && (
      <p className="text-[10px] font-body text-text-secondary/40 text-right">
        Cotações de {dataFmt}
      </p>
    )}
    </div>
  )
}
