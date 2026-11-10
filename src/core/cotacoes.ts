import type { Confiabilidade, CotacaoAjustada } from './ativoHistorico'
import type { Transacao } from './types'

export interface PontoEvolucao {
  date: string
  total: number
  confiabilidade: Confiabilidade
}

/**
 * Tickers de cotação únicos, na ordem em que aparecem nas transações.
 * Remove duplicatas e valores vazios.
 */
export function extrairTickersUnicos(
  transacoes: Array<Pick<Transacao, 'tickerCotacao'>>,
): string[] {
  return [
    ...new Set(
      transacoes
        .map((t) => t.tickerCotacao)
        .filter((ticker) => ticker.length > 0),
    ),
  ]
}

/**
 * URL PostgREST da série ajustada apenas para os tickers informados.
 * Retorna null quando não há tickers — nesse caso nenhuma query deve
 * ser feita.
 */
export function montarUrlCotacoesAjustadas(
  tickers: readonly string[],
): string | null {
  const unicos = [...new Set(tickers.filter((ticker) => ticker.length > 0))]
  if (unicos.length === 0) return null
  return `/cotacoes_ajustadas?ativoTicker=in.(${unicos.join(',')})&order=data.asc`
}

/**
 * Preço ajustado mais recente por ticker. Funciona independentemente da
 * ordem da resposta; em empate de data, mantém a última ocorrência.
 */
export function mapearPrecoAjustadoMaisRecente(
  cotacoes: Array<
    Pick<CotacaoAjustada, 'ativoTicker' | 'data' | 'preco_ajustado'>
  >,
): Record<string, string> {
  const precos: Record<string, string> = {}
  const datas: Record<string, string> = {}

  for (const cotacao of cotacoes) {
    const dataAtual = datas[cotacao.ativoTicker]
    if (dataAtual === undefined || cotacao.data >= dataAtual) {
      precos[cotacao.ativoTicker] = cotacao.preco_ajustado
      datas[cotacao.ativoTicker] = cotacao.data
    }
  }

  return precos
}

/**
 * Série de evolução patrimonial: para cada data com cotação dos tickers
 * do usuário, soma quantidade mantida × preço ajustado. O preço bruto é
 * mantido em CotacaoAjustada apenas como referência e não entra no cálculo.
 */
export function montarEvolucaoPatrimonial(
  transacoes: Transacao[],
  cotacoes: Array<
    Pick<
      CotacaoAjustada,
      'ativoTicker' | 'data' | 'preco_ajustado' | 'confiabilidade'
    >
  >,
): PontoEvolucao[] {
  const precoPorDataTicker: Record<string, Record<string, number>> = {}

  for (const cotacao of cotacoes) {
    const preco = parseFloat(cotacao.preco_ajustado)
    if (!Number.isFinite(preco)) continue
    if (!precoPorDataTicker[cotacao.data]) {
      precoPorDataTicker[cotacao.data] = {}
    }
    precoPorDataTicker[cotacao.data][cotacao.ativoTicker] = preco
  }

  const datasOrdenadas = Object.keys(precoPorDataTicker).sort()
  const transacoesOrdenadas = [...transacoes].sort((a, b) =>
    a.data.localeCompare(b.data),
  )
  const evolucao: PontoEvolucao[] = []

  for (const data of datasOrdenadas) {
    const transacoesAntes = transacoesOrdenadas.filter((tx) => tx.data <= data)
    if (transacoesAntes.length === 0) continue

    const posicoes: Record<string, number> = {}
    for (const tx of transacoesAntes) {
      posicoes[tx.tickerCotacao] =
        (posicoes[tx.tickerCotacao] ?? 0) + tx.quantidade
    }

    const precos = precoPorDataTicker[data]
    let total = 0
    for (const [ticker, quantidade] of Object.entries(posicoes)) {
      total += (precos[ticker] ?? 0) * quantidade
    }

    evolucao.push({
      date: data,
      total,
      confiabilidade: data >= '2010-01-01' ? 'alta' : 'baixa',
    })
  }

  return evolucao
}
