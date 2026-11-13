import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { cachedFetch } from '../lib/cache'
import { neonFetch } from '../lib/neon'

export interface AtivoCatalog {
  ticker: string
  tickerCotacao: string
  tipo: 'ACAO' | 'FII'
  nome: string
  negociavel: boolean
}

/**
 * Catálogo de ativos (cache compartilhado 'ativos-catalog' via cachedFetch),
 * com estado loading/error. Dashboard, AtivosExplorer, AtivoHistorico e
 * Transactions hoje repetiam o mesmo call — o hook centraliza.
 */
export function useAtivos(): {
  ativos: AtivoCatalog[]
  loading: boolean
  error: string
} {
  const { user } = useAuth()
  const [ativos, setAtivos] = useState<AtivoCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelado = false
    cachedFetch<AtivoCatalog[]>(
      'ativos-catalog',
      () => neonFetch('/ativos?select=ticker,tickerCotacao,tipo,nome,negociavel', user.jwt),
    )
      .then((data) => {
        if (!cancelado) setAtivos(data)
      })
      .catch((e) => {
        if (!cancelado) setError(String(e))
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [user])

  return { ativos, loading, error }
}