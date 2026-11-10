import {
  deveExibirAvisoCobertura,
  deveExibirBadgeFii,
  filtrarPorPeriodo,
  formatarFatorEvento,
  linhaTracejada,
  montarSerieGrafico,
  temFatorAjuste,
  tipoEventoHumano,
  type CotacaoAjustada,
  type EventoCorporativo,
} from '../ativoHistorico'

function cotacao(
  data: string,
  preco: string,
  confiabilidade: 'alta' | 'baixa' = 'alta',
  fator = '1',
): CotacaoAjustada {
  return {
    ativoTicker: 'TST3',
    data,
    preco_bruto: preco,
    preco_ajustado: preco,
    fator_divisor: fator,
    confiabilidade,
  }
}

const evento: EventoCorporativo = {
  tipo: 'SPLIT',
  data_efetiva: '2020-06-16',
  descricao: null,
  ticker_relacionado: null,
  fator_ajuste: null,
}

describe('formatarFatorEvento', () => {
  it('formata split e bonificação como 1:fator', () => {
    expect(formatarFatorEvento(1.5)).toBe('1:1.5')
    expect(formatarFatorEvento(1.03)).toBe('1:1.03')
    expect(formatarFatorEvento('1.5')).toBe('1:1.5')
  })

  it('inverte grupamento para fator:1', () => {
    expect(formatarFatorEvento(0.1)).toBe('10:1')
    expect(formatarFatorEvento(0.5)).toBe('2:1')
  })

  it('omite fator ausente, inválido ou neutro', () => {
    expect(formatarFatorEvento(null)).toBeNull()
    expect(formatarFatorEvento(undefined)).toBeNull()
    expect(formatarFatorEvento(1)).toBeNull()
    expect(formatarFatorEvento(0)).toBeNull()
    expect(formatarFatorEvento(-2)).toBeNull()
    expect(formatarFatorEvento('abc')).toBeNull()
  })
})

describe('deveExibirAvisoCobertura', () => {
  const hoje = new Date(2026, 10, 9)

  it('é verdadeiro para ticker sem eventos e com histórico além de 5 anos', () => {
    expect(
      deveExibirAvisoCobertura([], [cotacao('2015-01-01', '10')], hoje),
    ).toBe(true)
  })

  it('é falso quando o histórico tem menos de 5 anos', () => {
    expect(
      deveExibirAvisoCobertura([], [cotacao('2022-01-01', '10')], hoje),
    ).toBe(false)
  })

  it('é falso quando há evento registrado', () => {
    expect(
      deveExibirAvisoCobertura([evento], [cotacao('2015-01-01', '10')], hoje),
    ).toBe(false)
  })

  it('é falso sem dados', () => {
    expect(deveExibirAvisoCobertura([], [], hoje)).toBe(false)
  })
})

describe('deveExibirBadgeFii', () => {
  it('é verdadeiro apenas para tipo FII', () => {
    expect(deveExibirBadgeFii('FII')).toBe(true)
    expect(deveExibirBadgeFii('ACAO')).toBe(false)
    expect(deveExibirBadgeFii(undefined)).toBe(false)
  })
})

describe('linhaTracejada', () => {
  it('deriva tracejado de confiabilidade baixa e sólido de alta', () => {
    expect(linhaTracejada('baixa')).toBe(true)
    expect(linhaTracejada('alta')).toBe(false)
  })
})

describe('temFatorAjuste', () => {
  it('detecta fator_divisor diferente de 1', () => {
    expect(temFatorAjuste([cotacao('2020-01-01', '10', 'alta', '1.5')])).toBe(true)
    expect(temFatorAjuste([cotacao('2020-01-01', '10', 'alta', '1')])).toBe(false)
  })
})

describe('filtrarPorPeriodo', () => {
  const dados = [
    cotacao('2008-01-01', '5'),
    cotacao('2018-11-21', '30'),
    cotacao('2021-01-01', '20'),
    cotacao('2025-12-26', '35'),
    cotacao('2026-11-06', '40'),
  ]

  it('Tudo mantém a série completa', () => {
    expect(filtrarPorPeriodo(dados, 'Tudo')).toHaveLength(5)
  })

  it('1A usa a data mais recente como referência', () => {
    expect(filtrarPorPeriodo(dados, '1A').map((d) => d.data)).toEqual([
      '2025-12-26',
      '2026-11-06',
    ])
  })

  it('5A ainda exclui o evento de 2018', () => {
    expect(filtrarPorPeriodo(dados, '5A').map((d) => d.data)).toEqual([
      '2025-12-26',
      '2026-11-06',
    ])
  })

  it('1M mantém apenas o último mês', () => {
    expect(filtrarPorPeriodo(dados, '1M').map((d) => d.data)).toEqual([
      '2026-11-06',
    ])
  })
})

describe('montarSerieGrafico', () => {
  it('separa preços alta e baixa em chaves distintas', () => {
    const serie = montarSerieGrafico([
      cotacao('2009-12-31', '10', 'baixa'),
      cotacao('2010-01-01', '11', 'alta'),
    ])
    expect(serie[0]).toEqual({ data: '2009-12-31', precoAlta: null, precoBaixa: 10 })
    expect(serie[1]).toEqual({ data: '2010-01-01', precoAlta: 11, precoBaixa: null })
  })
})

describe('tipoEventoHumano', () => {
  it('humaniza os tipos principais', () => {
    expect(tipoEventoHumano('SPLIT')).toBe('Split')
    expect(tipoEventoHumano('BONIFICACAO')).toBe('Bonificação')
    expect(tipoEventoHumano('GRUPAMENTO')).toBe('Grupamento')
  })
})
