import { AVISO_CSV_PRE_2010, type TransacaoAjustada } from './ajustarTransacoes'

export const COLUNAS_CSV = [
  'data',
  'ativoTicker',
  'tipo',
  'quantidade',
  'valorUnitario',
  'confiabilidade',
  'aviso',
] as const

/** Escapa aspas, vírgulas e quebras de linha conforme RFC 4180. */
function escaparCampo(valor: string): string {
  if (/[",\r\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

/**
 * Exporta as transações já ajustadas (mesmos valores exibidos na lista).
 * UTF-8 com BOM para o Excel reconhecer a acentuação.
 */
export function transacoesParaCsv(transacoes: TransacaoAjustada[]): string {
  const linhas: string[] = [COLUNAS_CSV.join(',')]

  for (const tx of transacoes) {
    const pre2010 = tx.data < '2010-01-01'
    linhas.push(
      [
        tx.data,
        tx.ativoTicker,
        tx.tipo,
        String(tx.quantidadeAjustada),
        tx.valorUnitarioAjustado,
        pre2010 ? 'baixa' : 'alta',
        pre2010 ? AVISO_CSV_PRE_2010 : '',
      ]
        .map(escaparCampo)
        .join(','),
    )
  }

  return '﻿' + linhas.join('\n')
}

export function nomeArquivoCsv(agora: Date = new Date()): string {
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `transacoes-${ano}-${mes}-${dia}.csv`
}

/** Gera o CSV e dispara o download no navegador. */
export function baixarCsvTransacoes(
  transacoes: TransacaoAjustada[],
  agora: Date = new Date(),
): void {
  const blob = new Blob([transacoesParaCsv(transacoes)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivoCsv(agora)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
