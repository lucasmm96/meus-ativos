import type { ResultadoAtivo } from '../../core/types'
import { AVISO_PRE_2010 } from '../../core/ajustarTransacoes'
import { Card } from '../Card'
import Decimal from 'decimal.js'

interface Props {
  resultados: ResultadoAtivo[]
  temAjuste?: boolean
  temPre2010?: boolean
}

function fmt(val: string) {
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mercadoOuInvestido(r: ResultadoAtivo): Decimal {
  return parseFloat(r.valorMercado) > 0
    ? new Decimal(r.valorMercado)
    : new Decimal(r.valorInvestido)
}

export function SummaryCards({ resultados, temAjuste = false, temPre2010 = false }: Props) {
  const totalAcoes = resultados
    .filter(r => r.tipo === 'ACAO')
    .reduce((s, r) => s.plus(mercadoOuInvestido(r)), new Decimal(0))
  const totalFiis = resultados
    .filter(r => r.tipo === 'FII')
    .reduce((s, r) => s.plus(mercadoOuInvestido(r)), new Decimal(0))
  const total = totalAcoes.plus(totalFiis)
  const totalPnl = resultados.reduce((s, r) => s.plus(r.pnl), new Decimal(0))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">Ações — Mercado</p>
        <p className="text-equity font-mono text-xl font-semibold tabular-nums">{fmt(totalAcoes.toString())}</p>
      </Card>
      <Card>
        <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">FIIs — Mercado</p>
        <p className="text-yield font-mono text-xl font-semibold tabular-nums">{fmt(totalFiis.toString())}</p>
      </Card>
      <Card>
        <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">Total — Mercado</p>
        <p className="text-text-primary font-mono text-xl font-semibold tabular-nums">{fmt(total.toString())}</p>
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-text-secondary font-body text-xs uppercase tracking-widest">P&amp;L — Mercado</p>
          {temAjuste && (
            <span
              className="px-2 py-0.5 rounded-full bg-equity/15 text-equity font-body text-[10px] font-semibold whitespace-nowrap"
              title="Quantidades e preços médios ajustados por eventos corporativos."
            >
              Série ajustada
            </span>
          )}
        </div>
        <p className={`font-mono text-xl font-semibold tabular-nums ${totalPnl.isNegative() ? 'text-alert' : 'text-equity'}`}>
          {fmt(totalPnl.toString())}
        </p>
        {temPre2010 && (
          <p className="text-yield font-body text-[11px] leading-snug mt-1" role="status">
            {AVISO_PRE_2010}
          </p>
        )}
      </Card>
    </div>
  )
}
