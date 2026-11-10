import type { TipoAtivo } from './types'

export type Confiabilidade = 'alta' | 'baixa'

export type TipoEventoCorporativo =
  | 'SPLIT'
  | 'GRUPAMENTO'
  | 'BONIFICACAO'
  | 'SUBSCRICAO'
  | 'MUDANCA_TICKER'
  | 'MUDANCA_NOME'
  | 'CISAO'
  | 'FUSAO'
  | 'INCORPORACAO'
  | 'IPO'
  | 'CANCELAMENTO'

export interface CotacaoAjustada {
  ativoTicker: string
  data: string
  preco_bruto: string
  preco_ajustado: string
  fator_divisor: string
  confiabilidade: Confiabilidade
}

export interface EventoCorporativo {
  tipo: TipoEventoCorporativo
  data_efetiva: string
  descricao: string | null
  ticker_relacionado: string | null
  fator_ajuste: number | null
}

export interface AtivoInfo {
  ticker: string
  nome: string
  tipo: TipoAtivo
}

export type Periodo = '1M' | '6M' | '1A' | '5A' | 'Tudo'

export const PERIODOS: Periodo[] = ['1M', '6M', '1A', '5A', 'Tudo']

export const TIPOS_TERMINAIS: TipoEventoCorporativo[] = [
  'CISAO',
  'FUSAO',
  'INCORPORACAO',
  'CANCELAMENTO',
]

const ROTULOS_EVENTO: Record<TipoEventoCorporativo, string> = {
  SPLIT: 'Split',
  GRUPAMENTO: 'Grupamento',
  BONIFICACAO: 'Bonificação',
  SUBSCRICAO: 'Subscrição',
  MUDANCA_TICKER: 'Mudança de ticker',
  MUDANCA_NOME: 'Mudança de nome',
  CISAO: 'Cisão',
  FUSAO: 'Fusão',
  INCORPORACAO: 'Incorporação',
  IPO: 'IPO',
  CANCELAMENTO: 'Cancelamento',
}

export interface PontoGrafico {
  data: string
  precoAlta: number | null
  precoBaixa: number | null
}

export function tipoEventoHumano(tipo: TipoEventoCorporativo): string {
  return ROTULOS_EVENTO[tipo] ?? tipo
}

// Formato de leitura: split/bonificação `1:1.5`; grupamento `10:1`
// (fator < 1 é invertido para a proporção ficar legível).
export function formatarFatorEvento(
  fator: number | string | null | undefined,
): string | null {
  if (fator == null) return null
  const valor = Number(fator)
  if (!Number.isFinite(valor) || valor <= 0) return null
  if (Math.abs(valor - 1) < 1e-9) return null

  const proporcao = valor < 1 ? 1 / valor : valor
  const texto = proporcao.toLocaleString('en-US', {
    maximumFractionDigits: 4,
    useGrouping: false,
  })
  return valor < 1 ? `${texto}:1` : `1:${texto}`
}

export function linhaTracejada(confiabilidade: Confiabilidade): boolean {
  return confiabilidade === 'baixa'
}

export function deveExibirBadgeFii(tipo: TipoAtivo | undefined | null): boolean {
  return tipo === 'FII'
}

export function temFatorAjuste(dados: CotacaoAjustada[]): boolean {
  return dados.some((d) => Math.abs(parseFloat(d.fator_divisor) - 1) > 1e-9)
}

function isoLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function deveExibirAvisoCobertura(
  eventos: EventoCorporativo[],
  dados: CotacaoAjustada[],
  hoje: Date = new Date(),
): boolean {
  if (eventos.length > 0 || dados.length === 0) return false
  const limite = new Date(hoje)
  limite.setFullYear(limite.getFullYear() - 5)
  const corte = isoLocal(limite)
  return dados.some((d) => d.data < corte)
}

function cutoffPeriodo(referencia: string, periodo: Periodo): string | null {
  if (periodo === 'Tudo') return null
  const data = new Date(`${referencia}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return null

  if (periodo === '1M') data.setUTCMonth(data.getUTCMonth() - 1)
  else if (periodo === '6M') data.setUTCMonth(data.getUTCMonth() - 6)
  else if (periodo === '1A') data.setUTCFullYear(data.getUTCFullYear() - 1)
  else data.setUTCFullYear(data.getUTCFullYear() - 5)

  return data.toISOString().slice(0, 10)
}

export function filtrarPorPeriodo(
  dados: CotacaoAjustada[],
  periodo: Periodo,
  referencia: string = dados[dados.length - 1]?.data ?? '',
): CotacaoAjustada[] {
  if (periodo === 'Tudo' || dados.length === 0) return dados
  const corte = cutoffPeriodo(referencia, periodo)
  if (!corte) return dados
  return dados.filter((d) => d.data >= corte)
}

export function montarSerieGrafico(dados: CotacaoAjustada[]): PontoGrafico[] {
  return dados.map((d) => {
    const preco = parseFloat(d.preco_ajustado)
    const alta = d.confiabilidade === 'alta'
    return {
      data: d.data,
      precoAlta: alta ? preco : null,
      precoBaixa: alta ? null : preco,
    }
  })
}

export function eventoTerminal(
  eventos: EventoCorporativo[],
): EventoCorporativo | undefined {
  return eventos.find((e) => TIPOS_TERMINAIS.includes(e.tipo))
}

export function textoEventoTerminal(evento: EventoCorporativo): string {
  const data = formatarData(evento.data_efetiva)
  const relacionado = evento.ticker_relacionado ? ` por ${evento.ticker_relacionado}` : ''
  switch (evento.tipo) {
    case 'CISAO':
      return `Este ativo foi cindido${relacionado} em ${data}.`
    case 'FUSAO':
      return `Este ativo foi fundido${relacionado} em ${data}.`
    case 'INCORPORACAO':
      return `Este ativo foi incorporado${relacionado} em ${data}.`
    case 'CANCELAMENTO':
      return `Este ativo foi cancelado em ${data}.`
    default:
      return `Evento societário em ${data}.`
  }
}

export function formatarData(iso: string): string {
  const data = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(data.getTime())) return iso
  return data.toLocaleDateString('pt-BR')
}
