import type { CotacaoAjustada } from './ativoHistorico'

function serieAlta(dados: CotacaoAjustada[]): CotacaoAjustada[] {
  return dados
    .filter((d) => d.confiabilidade === 'alta')
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data))
}

function precosValidos(dados: CotacaoAjustada[]): number[] {
  return dados
    .map((d) => parseFloat(d.preco_ajustado))
    .filter((p) => Number.isFinite(p) && p > 0)
}

/**
 * Retorno percentual do período, calculado apenas sobre a série com
 * confiabilidade alta (pós-2010). Retorna null se não houver ao menos
 * dois preços válidos.
 */
export function calcularRetornoPeriodo(dados: CotacaoAjustada[]): number | null {
  const precos = precosValidos(serieAlta(dados))
  if (precos.length < 2) return null
  const primeiro = precos[0]
  const ultimo = precos[precos.length - 1]
  return ultimo / primeiro - 1
}

/**
 * CAGR anualizado sobre a série alta. `anos` pode ser informado; se
 * omitido, é derivado da distância entre a primeira e a última data.
 */
export function calcularCAGR(dados: CotacaoAjustada[], anos?: number): number | null {
  const alta = serieAlta(dados)
  const precos = precosValidos(alta)
  if (precos.length < 2) return null

  const primeiro = precos[0]
  const ultimo = precos[precos.length - 1]

  let periodo = anos
  if (periodo === undefined) {
    const inicio = new Date(`${alta[0].data}T00:00:00Z`).getTime()
    const fim = new Date(`${alta[alta.length - 1].data}T00:00:00Z`).getTime()
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return null
    periodo = (fim - inicio) / (365.25 * 24 * 60 * 60 * 1000)
  }

  if (!Number.isFinite(periodo) || periodo <= 0) return null
  return Math.pow(ultimo / primeiro, 1 / periodo) - 1
}

/**
 * Volatilidade anualizada (desvio-padrão dos log-retornos diários ×
 * √252), calculada apenas sobre a série alta.
 */
export function calcularVolatilidade(dados: CotacaoAjustada[]): number | null {
  const precos = precosValidos(serieAlta(dados))
  if (precos.length < 3) return null

  const retornos: number[] = []
  for (let i = 1; i < precos.length; i += 1) {
    retornos.push(Math.log(precos[i] / precos[i - 1]))
  }
  if (retornos.length < 2) return null

  const media = retornos.reduce((s, r) => s + r, 0) / retornos.length
  const variancia =
    retornos.reduce((s, r) => s + (r - media) ** 2, 0) / (retornos.length - 1)
  return Math.sqrt(variancia) * Math.sqrt(252)
}
