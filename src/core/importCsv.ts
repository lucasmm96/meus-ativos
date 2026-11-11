import Decimal from 'decimal.js'
import type { TipoAtivo } from './types'

export const COLUNAS_IMPORTACAO = [
  'DATA',
  'TICKER',
  'TIPO',
  'VALOR',
  'QUANTIDADE',
] as const

export const NOME_MODELO_IMPORTACAO = 'modelo-importacao.csv'
export const LINHA_EXEMPLO_IMPORTACAO = '2023-09-11;ITSA4F;ACAO;9,07;22'

export interface AtivoImportacao {
  ticker: string
  tipo: TipoAtivo
}

export interface TransacaoExistenteImportacao {
  ativoTicker: string
  data: string
  valorUnitario: string
  quantidade: number
}

export interface LinhaImportacao {
  /** Número da linha no arquivo original (cabeçalho = 1). */
  linha: number
  ativoTicker: string
  tipo: TipoAtivo
  data: string
  valorUnitario: string
  quantidade: number
}

export interface DuplicadaImportacao {
  linha: number
  motivo: 'arquivo' | 'existente'
}

export interface ErroImportacao {
  linha: number
  mensagem: string
}

export interface ResultadoImportacao {
  /** Linhas válidas e não duplicadas, prontas para inserir. */
  linhas: LinhaImportacao[]
  duplicadas: DuplicadaImportacao[]
  /** Qualquer erro bloqueia a importação do arquivo inteiro. */
  erros: ErroImportacao[]
}

interface LinhaCsv {
  linha: number
  campos: string[]
}

interface ResultadoParseCsv {
  linhas: LinhaCsv[]
  erro: string | null
  linhaErro: number
}

/**
 * Lê CSV com `;` como separador (padrão do modelo), aceitando campos entre
 * aspas e CRLF. Linhas em branco são ignoradas, mas a numeração original é
 * preservada nos erros.
 */
function parseCsv(texto: string): ResultadoParseCsv {
  const conteudo = texto.replace(/^﻿/, '')
  const linhas: LinhaCsv[] = []
  let campos: string[] = []
  let campo = ''
  let emAspas = false
  let linhaAtual = 1
  let linhaInicial = 1

  const concluirLinha = () => {
    campos.push(campo)
    campo = ''
    const vazia = campos.every((valor) => valor.trim() === '')
    if (!vazia) {
      linhas.push({ linha: linhaInicial, campos })
    }
    campos = []
    linhaAtual += 1
    linhaInicial = linhaAtual
  }

  for (let i = 0; i < conteudo.length; i += 1) {
    const caractere = conteudo[i]

    if (emAspas) {
      if (caractere === '"') {
        if (conteudo[i + 1] === '"') {
          campo += '"'
          i += 1
        } else {
          emAspas = false
        }
      } else {
        if (caractere === '\n') linhaAtual += 1
        campo += caractere
      }
      continue
    }

    if (caractere === '"' && campo === '') {
      emAspas = true
    } else if (caractere === ';') {
      campos.push(campo)
      campo = ''
    } else if (caractere === '\n') {
      concluirLinha()
    } else if (caractere === '\r') {
      continue
    } else {
      campo += caractere
    }
  }

  if (emAspas) {
    return {
      linhas,
      erro: 'Aspas não fechadas no arquivo.',
      linhaErro: linhaInicial,
    }
  }

  if (campo !== '' || campos.length > 0) {
    concluirLinha()
  }

  return { linhas, erro: null, linhaErro: 0 }
}

function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const [ano, mes, dia] = data.split('-').map(Number)
  const verificacao = new Date(Date.UTC(ano, mes - 1, dia))
  return (
    verificacao.getUTCFullYear() === ano &&
    verificacao.getUTCMonth() === mes - 1 &&
    verificacao.getUTCDate() === dia
  )
}

interface ValorNormalizado {
  valor: string | null
  erro: string | null
}

function normalizarValor(bruto: string): ValorNormalizado {
  const texto = bruto.trim()
  if (texto === '') return { valor: null, erro: 'VALOR vazio.' }
  if (texto.includes(',') && texto.includes('.')) {
    return {
      valor: null,
      erro: `VALOR inválido: "${bruto}". Use vírgula ou ponto decimal, não ambos.`,
    }
  }
  if (!/^\d+(?:[.,]\d+)?$/.test(texto)) {
    return { valor: null, erro: `VALOR inválido: "${bruto}".` }
  }

  const normalizado = texto.replace(',', '.')
  const [inteiro, decimais = ''] = normalizado.split('.')
  if (decimais.length > 6) {
    return { valor: null, erro: 'VALOR tem mais de 6 casas decimais.' }
  }
  if (inteiro.replace(/^0+/, '').length > 12) {
    return { valor: null, erro: 'VALOR excede o limite permitido.' }
  }

  const decimal = new Decimal(normalizado)
  if (decimal.lte(0)) {
    return { valor: null, erro: 'VALOR deve ser maior que zero.' }
  }

  return { valor: decimal.toString(), erro: null }
}

function chaveTransacao(
  ativoTicker: string,
  data: string,
  valorUnitario: string,
  quantidade: number,
): string | null {
  try {
    return [
      ativoTicker.toUpperCase(),
      data,
      new Decimal(valorUnitario).toFixed(6),
      quantidade,
    ].join('|')
  } catch {
    return null
  }
}

/**
 * Valida o CSV inteiro. Uma linha inválida é reportada em `erros` e a UI deve
 * bloquear a importação até o arquivo ser corrigido. Duplicatas (já no banco
 * ou repetidas no arquivo) são reportadas e ignoradas.
 */
export function importarCsv(
  texto: string,
  ativos: AtivoImportacao[],
  existentes: TransacaoExistenteImportacao[] = [],
): ResultadoImportacao {
  const resultado: ResultadoImportacao = {
    linhas: [],
    duplicadas: [],
    erros: [],
  }

  const parse = parseCsv(texto)
  if (parse.erro) {
    resultado.erros.push({ linha: parse.linhaErro, mensagem: parse.erro })
    return resultado
  }
  if (parse.linhas.length === 0) {
    resultado.erros.push({ linha: 1, mensagem: 'Arquivo vazio.' })
    return resultado
  }

  const cabecalho = parse.linhas[0]
  const colunas = cabecalho.campos.map((valor) => valor.trim().toUpperCase())
  const cabecalhoValido =
    colunas.length === COLUNAS_IMPORTACAO.length &&
    colunas.every((valor, indice) => valor === COLUNAS_IMPORTACAO[indice])
  if (!cabecalhoValido) {
    resultado.erros.push({
      linha: cabecalho.linha,
      mensagem: `Cabeçalho inválido. Esperado: ${COLUNAS_IMPORTACAO.join(';')}.`,
    })
    return resultado
  }

  const ativosPorTicker = new Map(
    ativos.map((ativo) => [ativo.ticker.toUpperCase(), ativo]),
  )
  const existentesSet = new Set<string>()
  for (const transacao of existentes) {
    const chave = chaveTransacao(
      transacao.ativoTicker,
      transacao.data,
      transacao.valorUnitario,
      transacao.quantidade,
    )
    if (chave) existentesSet.add(chave)
  }
  const vistosNoArquivo = new Set<string>()

  for (const registro of parse.linhas.slice(1)) {
    const { linha, campos } = registro
    if (campos.length !== COLUNAS_IMPORTACAO.length) {
      resultado.erros.push({
        linha,
        mensagem: `Número de colunas inválido: esperado ${COLUNAS_IMPORTACAO.length}, recebido ${campos.length}.`,
      })
      continue
    }

    const [data, tickerBruto, tipoBruto, valorBruto, quantidadeBruto] =
      campos.map((campo) => campo.trim())
    let linhaInvalida = false
    const adicionarErro = (mensagem: string) => {
      resultado.erros.push({ linha, mensagem })
      linhaInvalida = true
    }

    if (!dataValida(data)) {
      adicionarErro(`DATA inválida: "${data}". Use AAAA-MM-DD.`)
    }

    const ticker = tickerBruto.toUpperCase()
    const ativo = ativosPorTicker.get(ticker)
    if (ticker === '') {
      adicionarErro('TICKER vazio.')
    } else if (!ativo) {
      adicionarErro(`TICKER não encontrado no cadastro: ${tickerBruto}.`)
    }

    const tipoBrutoNormalizado = tipoBruto.toUpperCase()
    let tipo: TipoAtivo | null = null
    if (
      tipoBrutoNormalizado !== 'ACAO' &&
      tipoBrutoNormalizado !== 'FII'
    ) {
      adicionarErro(`TIPO inválido: "${tipoBruto}". Use ACAO ou FII.`)
    } else {
      tipo = tipoBrutoNormalizado
      if (ativo && ativo.tipo !== tipo) {
        adicionarErro(
          `TIPO ${tipo} não corresponde ao cadastro de ${ativo.ticker} (${ativo.tipo}).`,
        )
      }
    }

    const valor = normalizarValor(valorBruto)
    if (valor.erro) adicionarErro(valor.erro)

    let quantidade = 0
    if (!/^\d+$/.test(quantidadeBruto)) {
      adicionarErro('QUANTIDADE deve ser um número inteiro maior que zero.')
    } else {
      quantidade = Number(quantidadeBruto)
      if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
        adicionarErro('QUANTIDADE deve ser um número inteiro maior que zero.')
      } else if (quantidade > 2_147_483_647) {
        adicionarErro('QUANTIDADE excede o limite permitido.')
      }
    }

    if (linhaInvalida || !ativo || !valor.valor || !tipo) continue

    const chave = chaveTransacao(ativo.ticker, data, valor.valor, quantidade)
    if (chave && existentesSet.has(chave)) {
      resultado.duplicadas.push({ linha, motivo: 'existente' })
      continue
    }
    if (chave && vistosNoArquivo.has(chave)) {
      resultado.duplicadas.push({ linha, motivo: 'arquivo' })
      continue
    }
    if (chave) vistosNoArquivo.add(chave)

    resultado.linhas.push({
      linha,
      ativoTicker: ativo.ticker,
      tipo,
      data,
      valorUnitario: valor.valor,
      quantidade,
    })
  }

  return resultado
}

/** Modelo com apenas o cabeçalho, para o usuário preencher. */
export function modeloImportacaoCsv(): string {
  return '﻿' + COLUNAS_IMPORTACAO.join(';') + '\n'
}

export function baixarModeloImportacaoCsv(): void {
  const blob = new Blob([modeloImportacaoCsv()], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = NOME_MODELO_IMPORTACAO
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
