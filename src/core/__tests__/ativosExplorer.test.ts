import {
  filtrarAtivos,
  formatarMoeda,
  formatarRetorno,
  normalizarBusca,
  ordenarAtivos,
  posicaoFaixa52s,
  type AtivoResumo,
} from '../ativosExplorer'

function ativo(overrides: Partial<AtivoResumo> & { ticker: string }): AtivoResumo {
  return {
    nome: overrides.ticker,
    tipo: 'ACAO',
    data_ultima: '2026-11-06',
    preco_atual: '10',
    maxima_52s: '12',
    minima_52s: '8',
    preco_12m: '9',
    retorno_12m: '0.1',
    ...overrides,
  }
}

const ativos: AtivoResumo[] = [
  ativo({
    ticker: 'ITUB4',
    nome: 'Itaú Unibanco',
    preco_atual: '36.5',
    maxima_52s: '40',
    minima_52s: '30',
    retorno_12m: '0.106061',
  }),
  ativo({
    ticker: 'PETR4',
    nome: 'Petróleo Brasileiro',
    preco_atual: '40',
    maxima_52s: '45',
    minima_52s: '35',
    retorno_12m: '-0.05',
  }),
  ativo({
    ticker: 'MXRF11',
    nome: 'Maxi Renda',
    tipo: 'FII',
    preco_atual: '10',
    maxima_52s: null,
    minima_52s: null,
    preco_12m: null,
    retorno_12m: null,
  }),
]

describe('normalizarBusca', () => {
  it('remove acentos, caixa e espaços nas bordas', () => {
    expect(normalizarBusca('  Itaú  ')).toBe('itau')
    expect(normalizarBusca('PETRÓLEO')).toBe('petroleo')
  })
})

describe('filtrarAtivos', () => {
  it('retorna todos quando não há busca nem filtro', () => {
    expect(filtrarAtivos(ativos, '', 'TODOS')).toHaveLength(3)
  })

  it('busca por nome sem acento e por ticker', () => {
    expect(filtrarAtivos(ativos, 'itau', 'TODOS').map((a) => a.ticker)).toEqual([
      'ITUB4',
    ])
    expect(
      filtrarAtivos(ativos, 'petroleo', 'TODOS').map((a) => a.ticker),
    ).toEqual(['PETR4'])
    expect(filtrarAtivos(ativos, 'mxrf', 'TODOS').map((a) => a.ticker)).toEqual([
      'MXRF11',
    ])
  })

  it('combina busca com filtro de tipo', () => {
    expect(filtrarAtivos(ativos, '', 'FII').map((a) => a.ticker)).toEqual([
      'MXRF11',
    ])
    expect(filtrarAtivos(ativos, 'itau', 'FII')).toHaveLength(0)
  })
})

describe('ordenarAtivos', () => {
  it('ordena por nome, ticker e retorno 12m (nulos por último)', () => {
    expect(ordenarAtivos(ativos, 'nome').map((a) => a.ticker)).toEqual([
      'ITUB4',
      'MXRF11',
      'PETR4',
    ])
    expect(ordenarAtivos(ativos, 'ticker').map((a) => a.ticker)).toEqual([
      'ITUB4',
      'MXRF11',
      'PETR4',
    ])
    expect(ordenarAtivos(ativos, 'retorno12m').map((a) => a.ticker)).toEqual([
      'ITUB4',
      'PETR4',
      'MXRF11',
    ])
  })

  it('não muta o array original', () => {
    const copia = [...ativos]
    ordenarAtivos(ativos, 'retorno12m')
    expect(ativos).toEqual(copia)
  })
})

describe('formatarMoeda', () => {
  it('formata número e string em BRL', () => {
    expect(formatarMoeda('36.5')).toContain('36,50')
    expect(formatarMoeda('10')).toContain('10,00')
  })

  it('retorna travessão para nulo ou inválido', () => {
    expect(formatarMoeda(null)).toBe('—')
    expect(formatarMoeda('abc')).toBe('—')
  })
})

describe('formatarRetorno', () => {
  it('usa sinal de mais apenas para retorno positivo', () => {
    expect(formatarRetorno('0.1')).toBe('+10,00%')
    expect(formatarRetorno('-0.05')).toBe('-5,00%')
    expect(formatarRetorno('0')).toBe('0,00%')
  })

  it('retorna travessão para nulo ou inválido', () => {
    expect(formatarRetorno(null)).toBe('—')
    expect(formatarRetorno('abc')).toBe('—')
  })
})

describe('posicaoFaixa52s', () => {
  it('calcula a posição do preço dentro da faixa', () => {
    expect(
      posicaoFaixa52s(
        ativo({
          ticker: 'X',
          preco_atual: '35',
          minima_52s: '30',
          maxima_52s: '40',
        }),
      ),
    ).toBe(0.5)
  })

  it('limita a posição ao intervalo 0..1', () => {
    expect(
      posicaoFaixa52s(ativo({ ticker: 'X', preco_atual: '5' })),
    ).toBe(0)
    expect(
      posicaoFaixa52s(ativo({ ticker: 'X', preco_atual: '20' })),
    ).toBe(1)
  })

  it('retorna null quando a faixa não é utilizável', () => {
    expect(
      posicaoFaixa52s(
        ativo({ ticker: 'X', minima_52s: null, maxima_52s: null }),
      ),
    ).toBeNull()
    expect(
      posicaoFaixa52s(
        ativo({ ticker: 'X', minima_52s: '10', maxima_52s: '10' }),
      ),
    ).toBeNull()
  })
})
