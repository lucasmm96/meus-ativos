import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { neonFetch } from '../lib/neon'
import { calcularCarteira } from '../core/calculo'
import type { CotacaoAjustada } from '../core/ativoHistorico'
import {
  fatoresPorTransacao,
  type EventoAjuste,
} from '../core/ajustarTransacoes'
import {
  extrairTickersUnicos,
  montarEvolucaoPatrimonial,
  montarUrlCotacoesAjustadas,
  type PontoEvolucao,
} from '../core/cotacoes'
import type { TransacaoRow, Transacao, ResultadoAtivo } from '../core/types'
import { SkeletonCard } from '../components'
import { cachedFetch } from '../lib/cache'
import { SummaryCards } from '../components/charts/SummaryCards'
import { AllocationPie } from '../components/charts/AllocationPie'
import { AllocationBar } from '../components/charts/AllocationBar'
import { EvolutionLine } from '../components/charts/EvolutionLine'

export function Dashboard() {
  const { user } = useAuth()
  const [resultados, setResultados] = useState<ResultadoAtivo[]>([])
  const [evolutionData, setEvolutionData] = useState<PontoEvolucao[]>([])
  const [temPre2010, setTemPre2010] = useState(false)
  const [dataAtualizacao, setDataAtualizacao] = useState('')
  const [loadingMain, setLoadingMain] = useState(true)
  const [loadingEvolution, setLoadingEvolution] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        // Fase 1: transações + mapa de ativos (paralelo)
        const [rows, ativos] = await Promise.all([
          neonFetch<TransacaoRow[]>(`/transacoes?userId=eq.${user!.id}&select=*`, user!.jwt),
          cachedFetch<{ ticker: string; tickerCotacao: string; tipo: 'ACAO' | 'FII'; nome: string; negociavel: boolean }[]>(
            'ativos-catalog',
            () => neonFetch('/ativos?select=ticker,tickerCotacao,tipo,nome,negociavel', user!.jwt),
          ),
        ])
        const ativosMap = Object.fromEntries(ativos.map(a => [a.ticker, a]))
        const txs: Transacao[] = rows.map(r => ({
          ...r,
          tickerCotacao: ativosMap[r.ativoTicker]?.tickerCotacao ?? r.ativoTicker,
          tipo: ativosMap[r.ativoTicker]?.tipo ?? 'ACAO',
        }))

        const tickers = extrairTickersUnicos(txs)
        const dataMin = txs.reduce((min, t) => (t.data < min ? t.data : min), txs[0]?.data ?? '')
        const urlCotacoes = montarUrlCotacoesAjustadas(tickers, {
          desde: dataMin || undefined,
          select: ['ativoTicker', 'data', 'preco_ajustado', 'confiabilidade'],
        })
        if (!urlCotacoes) {
          setResultados([])
          setEvolutionData([])
          setTemPre2010(false)
          setLoadingMain(false)
          setLoadingEvolution(false)
          return
        }

        const tickersEventos = [
          ...new Set(txs.flatMap(t =>
            t.ativoTicker === t.tickerCotacao
              ? [t.ativoTicker]
              : [t.ativoTicker, t.tickerCotacao],
          )),
        ]
        const urlEventos = `/eventos_corporativos?ticker=in.(${tickersEventos.join(',')})&tipo=in.(SPLIT,GRUPAMENTO,BONIFICACAO)&select=ticker,data_efetiva,fator_ajuste,tipo&order=data_efetiva.asc`

        // Fase 2: inicia as 3 fetches em paralelo.
        // cotacoes_ajustadas retorna ~20k linhas — não bloqueia a UI principal.
        const cotacoesP = neonFetch<CotacaoAjustada[]>(urlCotacoes, user!.jwt)

        // Fase 2a: preços atuais + eventos → rápido (~11 linhas) → mostra cards/gráficos
        const [ativosResumo, eventos] = await Promise.all([
          neonFetch<{ ticker: string; preco_atual: string; data_ultima: string }[]>(
            `/ativos_resumo?ticker=in.(${tickers.join(',')})&select=ticker,preco_atual,data_ultima`,
            user!.jwt,
          ),
          neonFetch<EventoAjuste[]>(urlEventos, user!.jwt),
        ])
        const cotacoesMap = Object.fromEntries(ativosResumo.map(a => [a.ticker, a.preco_atual]))
        const dataMax = ativosResumo.reduce((max, a) => (a.data_ultima > max ? a.data_ultima : max), '')
        const fatores = fatoresPorTransacao(txs, eventos)
        setTemPre2010(txs.some(t => t.data < '2010-01-01'))
        setDataAtualizacao(dataMax)
        setResultados(calcularCarteira(txs, cotacoesMap, fatores))
        setLoadingMain(false)

        // Fase 2b: série histórica completa → só para o gráfico de evolução
        const cotacoes = await cotacoesP
        setEvolutionData(montarEvolucaoPatrimonial(txs, cotacoes, fatores))
      } catch (e) {
        setError(String(e))
        setLoadingMain(false)
      } finally {
        setLoadingEvolution(false)
      }
    }
    load()
  }, [user])

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loadingMain && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-48" />)}
            </div>
            <SkeletonCard className="h-64" />
          </div>
        )}
        {error && <p className="text-alert font-body text-sm">{error}</p>}

        {!loadingMain && !error && (
          <>
            <SummaryCards resultados={resultados} temPre2010={temPre2010} dataAtualizacao={dataAtualizacao} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AllocationPie resultados={resultados} mode="valor" />
              <AllocationPie resultados={resultados} mode="cotas" />
              <AllocationBar resultados={resultados} mode="valor" />
              <AllocationBar resultados={resultados} mode="cotas" />
            </div>

            {loadingEvolution
              ? <SkeletonCard className="h-64" />
              : <EvolutionLine data={evolutionData} />
            }
          </>
        )}
      </main>
  )
}
