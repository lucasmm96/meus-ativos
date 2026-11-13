import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { cachedFetch } from '../lib/cache'
import { neonFetch } from '../lib/neon'
import type { EventoAjuste } from '../core/ajustarTransacoes'
import type { Transacao, TransacaoRow } from '../core/types'
import type { AtivoCatalog } from './useAtivos'

/**
 * Dados de transações do usuário: transações (com tickerCotacao/tipo do
 * catálogo), arquivamentos, eventos corporativos e refetch callable —
 * necessário para Transactions recarregar após mutations. Resultados de
 * requests em voo são descartados quando um novo fetch começa ou o
 * componente desmonta (geração incrementada).
 */
export function useTransacoes(): {
  transacoes: Transacao[]
  setTransacoes: React.Dispatch<React.SetStateAction<Transacao[]>>
  ativos: AtivoCatalog[]
  arquivamentos: Set<string>
  setArquivamentos: React.Dispatch<React.SetStateAction<Set<string>>>
  eventos: EventoAjuste[]
  loading: boolean
  error: string
  refetch: () => Promise<void>
} {
  const { user } = useAuth()
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [ativos, setAtivos] = useState<AtivoCatalog[]>([])
  const [arquivamentos, setArquivamentos] = useState<Set<string>>(new Set())
  const [eventos, setEventos] = useState<EventoAjuste[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const geracaoRef = useRef(0)

  const refetch = useCallback(async () => {
    if (!user) return
    const geracao = ++geracaoRef.current
    try {
      const [rows, ativosData, arquivamentosData] = await Promise.all([
        neonFetch<TransacaoRow[]>(
          `/transacoes?userId=eq.${user.id}&select=*&order=data.desc`,
          user.jwt,
        ),
        cachedFetch<AtivoCatalog[]>(
          'ativos-catalog',
          () => neonFetch('/ativos?select=ticker,tickerCotacao,tipo,nome,negociavel', user.jwt),
        ),
        neonFetch<{ transacaoId: string }[]>(
          `/arquivamentos?userId=eq.${user.id}&select=transacaoId`,
          user.jwt,
        ),
      ])
      if (geracao !== geracaoRef.current) return
      const ativosMap = Object.fromEntries(ativosData.map((a) => [a.ticker, a]))
      const txs: Transacao[] = rows.map((r) => ({
        ...r,
        tickerCotacao: ativosMap[r.ativoTicker]?.tickerCotacao ?? r.ativoTicker,
        tipo: ativosMap[r.ativoTicker]?.tipo ?? 'ACAO',
      }))
      setTransacoes(txs)
      setAtivos(ativosData)
      setArquivamentos(new Set(arquivamentosData.map((a) => a.transacaoId)))

      const tickersEventos = [
        ...new Set(
          txs.flatMap((t) =>
            t.ativoTicker === t.tickerCotacao
              ? [t.ativoTicker]
              : [t.ativoTicker, t.tickerCotacao],
          ),
        ),
      ]
      if (tickersEventos.length > 0) {
        const eventosData = await neonFetch<EventoAjuste[]>(
          `/eventos_corporativos?ticker=in.(${tickersEventos.join(',')})&tipo=in.(SPLIT,GRUPAMENTO,BONIFICACAO)&select=ticker,data_efetiva,fator_ajuste,tipo&order=data_efetiva.asc`,
          user.jwt,
        )
        if (geracao !== geracaoRef.current) return
        setEventos(eventosData)
      } else {
        setEventos([])
      }
    } catch (e) {
      if (geracao === geracaoRef.current) setError(String(e))
    } finally {
      if (geracao === geracaoRef.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refetch()
    return () => {
      // Invalida results de requests em voo após unmount.
      geracaoRef.current++
    }
  }, [refetch])

  return {
    transacoes,
    setTransacoes,
    ativos,
    arquivamentos,
    setArquivamentos,
    eventos,
    loading,
    error,
    refetch,
  }
}