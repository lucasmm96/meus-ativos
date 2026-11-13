import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { neonFetch } from '../lib/neon'
import { Button, Card, Input, SkeletonAtivo } from '../components'
import { useAtivos } from '../hooks/useAtivos'
import {
  FILTROS_ESCOPO,
  FILTROS_TIPO,
  ORDENS_ATIVOS,
  filtrarAtivos,
  filtrarPorEscopo,
  formatarMoeda,
  formatarRetorno,
  ordenarAtivos,
  posicaoFaixa52s,
  tickersDaCarteira,
  type AtivoResumo,
  type FiltroEscopo,
  type FiltroTipo,
  type OrdemAtivos,
  type TransacaoCarteira,
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
            <span className="font-sans font-semibold text-text-primary">
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
            <p className="font-mono text-sm font-semibold text-text-primary tabular-nums">
              {formatarMoeda(ativo.preco_atual)}
            </p>
          </div>

          <div className="text-right">
            <p className="font-body text-[10px] uppercase tracking-widest text-text-tertiary">
              12 meses
            </p>
            <p
              className={`font-mono text-sm font-semibold tabular-nums ${corRetorno}`}
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
            <p className="font-mono text-[10px] text-text-tertiary tabular-nums mt-1">
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
  const { ativos: catalogo, loading: catalogoLoading, error: catalogoError } = useAtivos()
  const [ativos, setAtivos] = useState<AtivoResumo[]>([])
  const [tickersCarteira, setTickersCarteira] = useState<Set<string>>(
    new Set(),
  )
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroTipo>('TODOS')
  const [escopo, setEscopo] = useState<FiltroEscopo>('CARTEIRA')
  const [ordem, setOrdem] = useState<OrdemAtivos>('nome')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelado = false

    async function load() {
      // Aguarda o catálogo compartilhado (useAtivos) para montar o mapa de
      // aliases antes de buscar a carteira.
      if (catalogoLoading) return
      if (catalogoError) {
        setError(catalogoError)
        setLoading(false)
        return
      }
      try {
        // Fase 1: transações do usuário (catálogo já veio do useAtivos)
        const [transacoes] = await Promise.all([
          neonFetch<TransacaoCarteira[]>(
            `/transacoes?userId=eq.${user!.id}&select=ativoTicker,quantidade`,
            user!.jwt,
          ),
        ])
        if (cancelado) return

        const aliasMap = Object.fromEntries(catalogo.map((a) => [a.ticker, a.tickerCotacao]))
        const tickers = tickersDaCarteira(transacoes, aliasMap)
        setTickersCarteira(tickers)

        // Fase 2a: só os tickers do usuário — mostra CARTEIRA imediatamente
        if (tickers.size > 0) {
          const carteiraData = await neonFetch<AtivoResumo[]>(
            `/ativos_resumo?ticker=in.(${[...tickers].join(',')})&select=${CAMPOS_RESUMO}`,
            user!.jwt,
          )
          if (cancelado) return
          setAtivos(carteiraData)
        }
        if (!cancelado) setLoading(false)
      } catch (e) {
        if (!cancelado) {
          setError(String(e))
          setLoading(false)
        }
        return
      }

      // Fase 2b: lista completa em background — pronta ao abrir aba MERCADO
      if (cancelado) return
      try {
        const todosDados = await neonFetch<AtivoResumo[]>(
          `/ativos_resumo?select=${CAMPOS_RESUMO}`,
          user!.jwt,
        )
        if (!cancelado) setAtivos(todosDados)
      } catch {
        // Falha não-fatal: visão CARTEIRA já carregada
      }
    }

    load()
    return () => {
      cancelado = true
    }
  }, [user, catalogo, catalogoLoading, catalogoError])

  const base = useMemo(
    () => filtrarPorEscopo(ativos, tickersCarteira, escopo),
    [ativos, tickersCarteira, escopo],
  )
  const visiveis = useMemo(
    () => ordenarAtivos(filtrarAtivos(base, busca, filtro), ordem),
    [base, busca, filtro, ordem],
  )

  return (
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

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-[10px] uppercase tracking-widest text-text-tertiary">
              Mostrar
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FILTROS_ESCOPO.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  aria-pressed={escopo === opcao.valor}
                  onClick={() => setEscopo(opcao.valor)}
                  className={`px-3 py-1 rounded-full font-body text-xs font-medium transition-colors ${
                    escopo === opcao.valor
                      ? 'bg-equity text-bg-base'
                      : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>

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
            {visiveis.length} de {base.length}{' '}
            {escopo === 'CARTEIRA' ? 'ativos na sua carteira' : 'ativos'}
          </p>
        </Card>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonAtivo key={i} />)}
          </div>
        )}
        {error && <p className="text-alert font-body text-sm">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2">
            {visiveis.map((ativo) => (
              <LinhaAtivo key={ativo.ticker} ativo={ativo} />
            ))}
            {visiveis.length === 0 && (
              <Card>
                <div className="text-center py-6 space-y-3">
                  <p className="font-body text-sm text-text-secondary">
                    {ativos.length === 0
                      ? 'Nenhum ativo disponível no banco.'
                      : escopo === 'CARTEIRA' && base.length === 0
                        ? 'Você ainda não possui ativos na carteira.'
                        : 'Nenhum ativo encontrado para os filtros atuais.'}
                  </p>
                  {ativos.length > 0 && escopo === 'CARTEIRA' && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEscopo('TODOS')}
                    >
                      Ver todos os ativos
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
  )
}
