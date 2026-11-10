import {
  COLUNAS_CSV,
  nomeArquivoCsv,
  transacoesParaCsv,
} from '../exportCsv'
import { ajustarTransacoes, AVISO_CSV_PRE_2010 } from '../ajustarTransacoes'
import type { Transacao } from '../types'

function transacao(overrides: Partial<Transacao> = {}): Transacao {
  return {
    id: 'tx-1',
    userId: 'user-1',
    ativoTicker: 'BBAS3',
    tickerCotacao: 'BBAS3',
    tipo: 'ACAO',
    data: '2023-01-02',
    valorUnitario: '25',
    quantidade: 100,
    ...overrides,
  }
}

function linhas(csv: string): string[] {
  return csv.replace(/^﻿/, '').split('\n')
}

describe('transacoesParaCsv', () => {
  it('começa com BOM e cabeçalho com as 7 colunas na ordem exigida', () => {
    const csv = transacoesParaCsv([])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(linhas(csv)[0]).toBe(
      'data,ativoTicker,tipo,quantidade,valorUnitario,confiabilidade,aviso',
    )
    expect(COLUNAS_CSV).toHaveLength(7)
  })

  it('exporta quantidade e preço ajustados', () => {
    const [ajustada] = ajustarTransacoes(
      [transacao({ valorUnitario: '25', quantidade: 100 })],
      [
        {
          ticker: 'BBAS3',
          data_efetiva: '2024-04-16',
          fator_ajuste: '2',
          tipo: 'SPLIT',
        },
      ],
    )
    const csv = transacoesParaCsv([ajustada])
    expect(linhas(csv)[1]).toBe('2023-01-02,BBAS3,ACAO,200,12.5,alta,')
  })

  it('marca confiabilidade baixa e aviso para data anterior a 2010', () => {
    const [ajustada] = ajustarTransacoes(
      [transacao({ data: '2009-12-31', quantidade: 10 })],
      [],
    )
    const csv = transacoesParaCsv([ajustada])
    expect(linhas(csv)[1]).toBe(
      `2009-12-31,BBAS3,ACAO,10,25,baixa,${AVISO_CSV_PRE_2010}`,
    )
  })

  it('não marca aviso em 2010-01-01', () => {
    const [ajustada] = ajustarTransacoes(
      [transacao({ data: '2010-01-01', quantidade: 10 })],
      [],
    )
    const csv = transacoesParaCsv([ajustada])
    expect(linhas(csv)[1]).toBe('2010-01-01,BBAS3,ACAO,10,25,alta,')
  })

  it('escapa vírgulas e aspas dentro dos campos', () => {
    const [ajustada] = ajustarTransacoes(
      [
        transacao({
          ativoTicker: 'TESTE,"3"',
          tickerCotacao: 'TESTE',
          quantidade: 1,
        }),
      ],
      [],
    )
    const csv = transacoesParaCsv([ajustada])
    expect(linhas(csv)[1]).toContain('TESTE,""3""')
  })
})

describe('nomeArquivoCsv', () => {
  it('usa a data local no formato transacoes-YYYY-MM-DD.csv', () => {
    expect(nomeArquivoCsv(new Date(2026, 10, 10))).toBe(
      'transacoes-2026-11-10.csv',
    )
  })
})
