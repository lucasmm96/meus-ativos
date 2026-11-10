import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { neonFetch } from '../lib/neon'
import { calcularCarteira } from '../core/calculo'
import type { CotacaoAjustada } from '../core/ativoHistorico'
import {
  extrairTickersUnicos,
  mapearPrecoAjustadoMaisRecente,
  montarEvolucaoPatrimonial,
  montarUrlCotacoesAjustadas,
  type PontoEvolucao,
} from '../core/cotacoes'
import type { TransacaoRow, Transacao, ResultadoAtivo } from '../core/types'
import { Button } from '../components'
import { SummaryCards } from '../components/charts/SummaryCards'
import { AllocationPie } from '../components/charts/AllocationPie'
import { AllocationBar } from '../components/charts/AllocationBar'
import { EvolutionLine } from '../components/charts/EvolutionLine'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [resultados, setResultados] = useState<ResultadoAtivo[]>([])
  const [evolutionData, setEvolutionData] = useState<PontoEvolucao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [rows, ativos] = await Promise.all([
          neonFetch<TransacaoRow[]>(`/transacoes?userId=eq.${user!.id}&select=*`, user!.jwt),
          neonFetch<{ ticker: string; tickerCotacao: string; tipo: 'ACAO' | 'FII' }[]>('/ativos?select=ticker,tickerCotacao,tipo', user!.jwt),
        ])
        const ativosMap = Object.fromEntries(ativos.map(a => [a.ticker, a]))
        const txs: Transacao[] = rows.map(r => ({
          ...r,
          tickerCotacao: ativosMap[r.ativoTicker]?.tickerCotacao ?? r.ativoTicker,
          tipo: ativosMap[r.ativoTicker]?.tipo ?? 'ACAO',
        }))

        const tickers = extrairTickersUnicos(txs)
        const urlCotacoes = montarUrlCotacoesAjustadas(tickers)
        if (!urlCotacoes) {
          setResultados([])
          setEvolutionData([])
          return
        }

        const cotacoes = await neonFetch<CotacaoAjustada[]>(urlCotacoes, user!.jwt)
        const cotacoesMap = mapearPrecoAjustadoMaisRecente(cotacoes)
        setResultados(calcularCarteira(txs, cotacoesMap))
        setEvolutionData(montarEvolucaoPatrimonial(txs, cotacoes))
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-card border-b border-border-subtle px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Meus Ativos" className="w-7 h-7" />
          <span className="font-display font-semibold text-text-primary text-lg">Meus Ativos</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/transactions">
            <Button variant="secondary" className="h-9 px-3 text-xs">Transações</Button>
          </Link>
          <Link to="/perfil">
            <Button variant="secondary" className="h-9 px-3 text-xs">Perfil</Button>
          </Link>
          <Button variant="secondary" className="h-9 px-3 text-xs" onClick={signOut}>Sair</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading && <p className="text-text-secondary font-body text-sm">Carregando...</p>}
        {error && <p className="text-alert font-body text-sm">{error}</p>}

        {!loading && !error && (
          <>
            <SummaryCards resultados={resultados} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AllocationPie resultados={resultados} mode="valor" />
              <AllocationPie resultados={resultados} mode="cotas" />
              <AllocationBar resultados={resultados} mode="valor" />
              <AllocationBar resultados={resultados} mode="cotas" />
            </div>

            <EvolutionLine data={evolutionData} />
          </>
        )}
      </main>
    </div>
  )
}
