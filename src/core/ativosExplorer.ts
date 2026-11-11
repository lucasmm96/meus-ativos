import type { TipoAtivo } from './types'

/** Linha da view `ativos_resumo` (uma por ativo). */
export interface AtivoResumo {
  ticker: string
  nome: string
  tipo: TipoAtivo
  data_ultima: string
  preco_atual: string
  maxima_52s: string | null
  minima_52s: string | null
  preco_12m: string | null
  retorno_12m: string | null
}

export type FiltroTipo = 'TODOS' | TipoAtivo
export type OrdemAtivos = 'nome' | 'ticker' | 'retorno12m'

export const FILTROS_TIPO: Array<{ valor: FiltroTipo; rotulo: string }> = [
  { valor: 'TODOS', rotulo: 'Todos' },
  { valor: 'ACAO', rotulo: 'Ações' },
  { valor: 'FII', rotulo: 'FIIs' },
]

export const ORDENS_ATIVOS: Array<{ valor: OrdemAtivos; rotulo: string }> = [
  { valor: 'nome', rotulo: 'Nome' },
  { valor: 'retorno12m', rotulo: 'Retorno 12m' },
  { valor: 'ticker', rotulo: 'Ticker' },
]

/** Normaliza para busca sem acento e sem caixa. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function filtrarAtivos(
  ativos: AtivoResumo[],
  busca: string,
  filtro: FiltroTipo,
): AtivoResumo[] {
  const termo = normalizarBusca(busca)
  return ativos.filter((ativo) => {
    if (filtro !== 'TODOS' && ativo.tipo !== filtro) return false
    if (!termo) return true
    return (
      normalizarBusca(ativo.ticker).includes(termo) ||
      normalizarBusca(ativo.nome).includes(termo)
    )
  })
}

function valorRetorno(ativo: AtivoResumo): number {
  if (ativo.retorno_12m == null) return Number.NEGATIVE_INFINITY
  const valor = Number(ativo.retorno_12m)
  return Number.isFinite(valor) ? valor : Number.NEGATIVE_INFINITY
}

export function ordenarAtivos(
  ativos: AtivoResumo[],
  ordem: OrdemAtivos,
): AtivoResumo[] {
  const copia = [...ativos]
  if (ordem === 'retorno12m') {
    return copia.sort(
      (a, b) =>
        valorRetorno(b) - valorRetorno(a) || a.ticker.localeCompare(b.ticker),
    )
  }
  if (ordem === 'ticker') {
    return copia.sort((a, b) => a.ticker.localeCompare(b.ticker))
  }
  return copia.sort(
    (a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR') ||
      a.ticker.localeCompare(b.ticker),
  )
}

export function formatarMoeda(valor: string | null): string {
  if (valor == null) return '—'
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatarRetorno(valor: string | null): string {
  if (valor == null) return '—'
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  const percentual = (numero * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return numero > 0 ? `+${percentual}%` : `${percentual}%`
}

/**
 * Posição do preço atual dentro da faixa de 52 semanas (0 = mínima,
 * 1 = máxima). Retorna null quando a faixa não é utilizável.
 */
export function posicaoFaixa52s(ativo: AtivoResumo): number | null {
  if (
    ativo.minima_52s == null ||
    ativo.maxima_52s == null ||
    ativo.preco_atual == null
  ) {
    return null
  }
  const minima = Number(ativo.minima_52s)
  const maxima = Number(ativo.maxima_52s)
  const atual = Number(ativo.preco_atual)
  if (
    !Number.isFinite(minima) ||
    !Number.isFinite(maxima) ||
    !Number.isFinite(atual) ||
    maxima <= minima
  ) {
    return null
  }
  return Math.min(1, Math.max(0, (atual - minima) / (maxima - minima)))
}
