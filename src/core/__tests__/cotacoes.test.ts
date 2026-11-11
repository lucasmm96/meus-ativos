import {
  extrairTickersUnicos,
  mapearPrecoAjustadoMaisRecente,
  montarEvolucaoPatrimonial,
  montarUrlCotacoesAjustadas,
} from '../cotacoes'
import type { CotacaoAjustada } from '../ativoHistorico'
import type { Transacao } from '../types'

function transacao(
  tickerCotacao: string,
  data: string,
  quantidade: number,
): Transacao {
  return {
    id: `${tickerCotacao}-${data}`,
    userId: 'user-1',
    ativoTicker: tickerCotacao,
    tickerCotacao,
    tipo: 'ACAO',
    data,
    valorUnitario: '10',
    quantidade,
  }
}

function cotacao(
  ativoTicker: string,
  data: string,
  precoAjustado: string,
  confiabilidade: 'alta' | 'baixa' = 'alta',
  precoBruto = precoAjustado,
): CotacaoAjustada {
  return {
    ativoTicker,
    data,
    preco_bruto: precoBruto,
    preco_ajustado: precoAjustado,
    fator_divisor: '1',
    confiabilidade,
  }
}

describe('extrairTickersUnicos', () => {
  it('remove duplicatas preservando a ordem de primeira aparição', () => {
    const transacoes = [
      transacao('VALE3', '2020-01-02', 1),
      transacao('VALE3', '2020-02-03', 1),
      transacao('PETR4', '2020-03-04', 1),
    ]

    expect(extrairTickersUnicos(transacoes)).toEqual(['VALE3', 'PETR4'])
  })

  it('retorna lista vazia quando não há transações', () => {
    expect(extrairTickersUnicos([])).toEqual([])
  })
})

describe('montarUrlCotacoesAjustadas', () => {
  it('monta a URL com um ticker', () => {
    expect(montarUrlCotacoesAjustadas(['VALE3'])).toBe(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3)&order=data.asc',
    )
  })

  it('monta a URL com dois tickers', () => {
    expect(montarUrlCotacoesAjustadas(['VALE3', 'PETR4'])).toBe(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3,PETR4)&order=data.asc',
    )
  })

  it('remove duplicatas antes de montar a URL', () => {
    expect(montarUrlCotacoesAjustadas(['VALE3', 'VALE3', 'PETR4'])).toBe(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3,PETR4)&order=data.asc',
    )
  })

  it('retorna null sem tickers, sinalizando que nenhuma query deve ser feita', () => {
    expect(montarUrlCotacoesAjustadas([])).toBeNull()
  })

  it('adiciona filtro de data quando desde é fornecido', () => {
    expect(montarUrlCotacoesAjustadas(['VALE3'], { desde: '2020-01-02' })).toBe(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3)&data=gte.2020-01-02&order=data.asc',
    )
  })

  it('adiciona select quando colunas são fornecidas', () => {
    expect(
      montarUrlCotacoesAjustadas(['VALE3'], {
        select: ['ativoTicker', 'data', 'preco_ajustado'],
      }),
    ).toBe(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3)&select=ativoTicker,data,preco_ajustado&order=data.asc',
    )
  })

  it('combina desde e select na mesma URL', () => {
    expect(
      montarUrlCotacoesAjustadas(['VALE3', 'PETR4'], {
        desde: '2018-05-10',
        select: ['ativoTicker', 'data', 'preco_ajustado', 'confiabilidade'],
      }),
    ).toBe(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3,PETR4)&data=gte.2018-05-10&select=ativoTicker,data,preco_ajustado,confiabilidade&order=data.asc',
    )
  })
})

describe('mapearPrecoAjustadoMaisRecente', () => {
  it('usa o preço ajustado e escolhe a data mais recente, independente da ordem', () => {
    const mapa = mapearPrecoAjustadoMaisRecente([
      cotacao('VALE3', '2026-01-02', '50', 'alta', '100'),
      cotacao('VALE3', '2020-01-02', '40', 'alta', '80'),
      cotacao('PETR4', '2026-01-02', '30'),
    ])

    expect(mapa).toEqual({ VALE3: '50', PETR4: '30' })
  })
})

describe('montarEvolucaoPatrimonial', () => {
  it('usa preco_ajustado e mantém a série contínua ao redor de um split', () => {
    const transacoes = [transacao('ITUB4', '2018-11-16', 10)]
    const cotacoes = [
      // Antes do split: bruto 52.72, ajustado 34.12.
      cotacao('ITUB4', '2018-11-19', '34.12', 'alta', '52.72'),
      // Depois do split: bruto 34.69, ajustado 34.69.
      cotacao('ITUB4', '2018-11-21', '34.69', 'alta', '34.69'),
    ]

    const evolucao = montarEvolucaoPatrimonial(transacoes, cotacoes)
    expect(evolucao).toHaveLength(2)
    expect(evolucao[0].total).toBeCloseTo(341.2, 2)
    expect(evolucao[1].total).toBeCloseTo(346.9, 2)

    const variacao = evolucao[1].total / evolucao[0].total - 1
    expect(Math.abs(variacao)).toBeLessThan(0.02)

    // Se preco_bruto fosse usado, o salto seria de mais de 50%.
    const variacaoBruta = 34.69 / 52.72 - 1
    expect(Math.abs(variacaoBruta)).toBeGreaterThan(0.3)
  })

  it('marca pontos pré-2010 como confiabilidade baixa', () => {
    const evolucao = montarEvolucaoPatrimonial(
      [transacao('ABCB4', '2008-01-02', 1)],
      [
        cotacao('ABCB4', '2008-06-02', '10', 'baixa'),
        cotacao('ABCB4', '2010-01-04', '13', 'alta'),
      ],
    )

    expect(evolucao.map((p) => p.confiabilidade)).toEqual(['baixa', 'alta'])
  })

  it('ignora datas anteriores à primeira transação', () => {
    const evolucao = montarEvolucaoPatrimonial(
      [transacao('VALE3', '2020-01-02', 10)],
      [
        cotacao('VALE3', '2019-12-30', '10'),
        cotacao('VALE3', '2020-01-02', '20'),
      ],
    )

    expect(evolucao).toEqual([
      { date: '2020-01-02', total: 200, confiabilidade: 'alta' },
    ])
  })

  it('retorna série vazia quando não há cotações', () => {
    expect(
      montarEvolucaoPatrimonial([transacao('VALE3', '2020-01-02', 10)], []),
    ).toEqual([])
  })
})
