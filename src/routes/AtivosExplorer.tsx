import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { neonFetch } from '../lib/neon'
import { Card, Input } from '../components'
import {
  FILTROS_TIPO,
  ORDENS_ATIVOS,
  filtrarAtivos,
  formatarMoeda,
  formatarRetorno,
  ordenarAtivos,
  posicaoFaixa52s,
  type AtivoResumo,
  type FiltroTipo,
  type OrdemAtivos,
} from '../core/ativosExplorer'

const CAMPOS_RESUMO =
  'ticker,nome,tipo,data_ultima,preco_atual,maxima_52s,minima_52s,preco_12m,retorno_12m'

function LinhaAtivo({ ativo }: { ativo: AtivoResumo }) {
  const posicao = posicaoFaixa52s(ativo)
  const retorno = ativo.retorno_12m == null ? null : Number(ativo.retorno_12m)
  const corRetorno =
    retorno == null
      ? 'text-text-tertiary'
      : retorno >= 0
        ? 'text-equity'
        : 'text-alert'

  return (
    <Link
      to={`/ativos/${ativo.ticker}`}
      aria-label={`Abrir histórico de ${ativo.ticker}`}
      className="block bg-surface-card border border-border-subtle rounded-xl p-4 hover:border-equity/50 transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-text-primary">
              {ativo.ticker}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-body text-[10px] font-semibold ${
                ativo.tipo === 'FII'
                  ? 'bg-yield/15 text-yield'
                  : 'bg-equity/15 text-equity'
              }`}
            >
              {ativo.tipo === 'FII' ? 'FII' : 'Ação'}
            </span>
          </div>
          <p className="font-body text-xs text-text-secondary truncate">
            {ativo.nome}
          </p>
        </div>

        <div className="flex items-center gap-5 sm:gap-6">
          <div className="text-right">
            <p className="font-body text-[10px] uppercase tracking-widest text-text-tertiary">
              Fechamento
            </p>
            <p className="font-body text-sm font-semibold text-text-primary tabular-nums">
              {formatarMoeda(ativo.preco_atual)}
            </p>
          </div>

          <div className="text-right">
            <p className="font-body text-[10px] uppercase tracking-widest text-text-tertiary">
              12 meses
            </p>
            <p
              className={`font-body text-sm font-semibold tabular-nums ${corRetorno}`}
            >
              {formatarRetorno(ativo.retorno_12m)}
            </p>
          </div>

          <div className="hidden md:block w-40">
            <p className="font-body text-[10px] uppercase tracking-widest text-text-tertiary">
              52 semanas
            </p>
            <div className="relative h-1.5 mt-1.5 rounded-full bg-surface-elevated">
              {posicao != null && (
                <span
                  className="absolute w-2 h-2 rounded-full bg-equity"
                  style={{
                    left: `${posicao * 100}%`,
                    top: '-1px',
                    transform: 'translateX(-50%)',
                  }}
                />
              )}
            </div>
            <p className="font-body text-[10px] text-text-tertiary tabular-nums mt-1">
              {formatarMoeda(ativo.minima_52s)} –{' '}
              {formatarMoeda(ativo.maxima_52s)}
            </p>
          </div>

          <span className="material-symbols-outlined text-text-tertiary text-[20px]">
            chevron_right
          </span>
        </div>
      </div>
    </Link>
  )
}

export function AtivosExplorer() {
  const { user } = useAuth()
  const [ativos, setAtivos] = useState<AtivoResumo[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroTipo>('TODOS')
  const [ordem, setOrdem] = useState<OrdemAtivos>('nome')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelado = false

    async function load() {
      try {
        const data = await neonFetch<AtivoResumo[]>(
          `/ativos_resumo?select=${CAMPOS_RESUMO}`,
          user!.jwt,
        )
        if (!cancelado) setAtivos(data)
      } catch (e) {
        if (!cancelado) setError(String(e))
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    load()
    return () => {
      cancelado = true
    }
  }, [user])

  const visiveis = useMemo(
    () => ordenarAtivos(filtrarAtivos(ativos, busca, filtro), ordem),
    [ativos, busca, filtro, ordem],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-surface-card border-b border-border-subtle px-4 py-3 flex items-center gap-2">
        <Link
          to="/"
          className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Voltar ao dashboard"
        >
          <span className="material-symbols-outlined text-[20px]">
            arrow_back
          </span>
        </Link>
        <div>
          <p className="font-body text-xs text-text-secondary uppercase tracking-widest">
            meus ativos
          </p>
          <h1 className="font-display font-semibold text-text-primary text-lg leading-tight">
            Ativos
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Card className="space-y-3">
          <Input
            id="busca-ativos"
            type="search"
            aria-label="Buscar ativo por ticker ou nome"
            placeholder="Buscar por ticker ou nome…"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTROS_TIPO.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  aria-pressed={filtro === opcao.valor}
                  onClick={() => setFiltro(opcao.valor)}
                  className={`px-3 py-1 rounded-full font-body text-xs font-medium transition-colors ${
                    filtro === opcao.valor
                      ? 'bg-equity text-bg-base'
                      : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="ordem-ativos"
                className="font-body text-xs text-text-secondary"
              >
                Ordenar
              </label>
              <select
                id="ordem-ativos"
                value={ordem}
                onChange={(evento) =>
                  setOrdem(evento.target.value as OrdemAtivos)
                }
                className="h-8 px-2 rounded-lg bg-bg-base border border-border-subtle text-text-primary font-body text-xs focus:outline-none focus:border-yield"
              >
                {ORDENS_ATIVOS.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="font-body text-xs text-text-tertiary">
            {visiveis.length} de {ativos.length} ativos
          </p>
        </Card>

        {loading && (
          <p className="text-text-secondary font-body text-sm">
            Carregando ativos...
          </p>
        )}
        {error && <p className="text-alert font-body text-sm">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2">
            {visiveis.map((ativo) => (
              <LinhaAtivo key={ativo.ticker} ativo={ativo} />
            ))}
            {visiveis.length === 0 && (
              <Card>
                <p className="font-body text-sm text-text-secondary text-center py-6">
                  {ativos.length === 0
                    ? 'Nenhum ativo disponível no banco.'
                    : 'Nenhum ativo encontrado para os filtros atuais.'}
                </p>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
