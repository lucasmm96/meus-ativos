import {
  calcularCAGR,
  calcularDrawdownMaximo,
  calcularFaixa52Semanas,
  calcularRetornoPeriodo,
  calcularVolatilidade,
} from '../indicadores'
import type { CotacaoAjustada } from '../ativoHistorico'

function cotacao(
  data: string,
  preco: string,
  confiabilidade: 'alta' | 'baixa' = 'alta',
): CotacaoAjustada {
  return {
    ativoTicker: 'TST3',
    data,
    preco_bruto: preco,
    preco_ajustado: preco,
    fator_divisor: '1',
    confiabilidade,
  }
}

describe('calcularRetornoPeriodo', () => {
  it('filtra confiabilidade baixa antes de calcular', () => {
    const dados = [
      cotacao('2009-01-01', '10', 'baixa'),
      cotacao('2010-01-01', '10', 'alta'),
      cotacao('2020-01-01', '20', 'alta'),
    ]
    expect(calcularRetornoPeriodo(dados)).toBeCloseTo(1.0)
  })

  it('retorna null quando só há dados baixa', () => {
    expect(
      calcularRetornoPeriodo([cotacao('2009-01-01', '10', 'baixa')]),
    ).toBeNull()
  })

  it('retorna null com menos de dois preços válidos', () => {
    expect(
      calcularRetornoPeriodo([cotacao('2020-01-01', '0'), cotacao('2021-01-01', '10')]),
    ).toBeNull()
  })
})

describe('calcularCAGR', () => {
  it('calcula CAGR sobre a série alta', () => {
    const dados = [
      cotacao('2009-01-01', '5', 'baixa'),
      cotacao('2010-01-01', '10', 'alta'),
      cotacao('2020-01-01', '20', 'alta'),
    ]
    const cagr = calcularCAGR(dados, 10)
    expect(cagr).not.toBeNull()
    expect(cagr!).toBeCloseTo(Math.pow(2, 1 / 10) - 1, 10)
  })

  it('retorna null se o período for inválido', () => {
    expect(
      calcularCAGR([cotacao('2020-01-01', '10'), cotacao('2021-01-01', '20')], 0),
    ).toBeNull()
  })
})

describe('calcularVolatilidade', () => {
  it('ignora a série baixa', () => {
    const comBaixa = [
      cotacao('2009-01-01', '1', 'baixa'),
      cotacao('2020-01-01', '10', 'alta'),
      cotacao('2020-01-02', '11', 'alta'),
      cotacao('2020-01-03', '10', 'alta'),
    ]
    const apenasAlta = comBaixa.slice(1)
    expect(calcularVolatilidade(comBaixa)).toBeCloseTo(
      calcularVolatilidade(apenasAlta)!,
      12,
    )
  })

  it('retorna null com menos de três preços', () => {
    expect(calcularVolatilidade([cotacao('2020-01-01', '10')])).toBeNull()
  })
})

describe('calcularDrawdownMaximo', () => {
  it('encontra a maior queda do pico ao fundo', () => {
    const dados = [
      cotacao('2020-01-01', '10'),
      cotacao('2020-01-02', '20'),
      cotacao('2020-01-03', '10'),
      cotacao('2020-01-04', '15'),
    ]
    expect(calcularDrawdownMaximo(dados)).toBeCloseTo(-0.5)
  })

  it('retorna 0 quando a série só sobe', () => {
    expect(
      calcularDrawdownMaximo([
        cotacao('2020-01-01', '10'),
        cotacao('2020-01-02', '20'),
      ]),
    ).toBe(0)
  })

  it('ignora a série baixa e retorna null com menos de dois preços', () => {
    expect(
      calcularDrawdownMaximo([
        cotacao('2009-01-01', '10', 'baixa'),
        cotacao('2009-06-01', '5', 'baixa'),
      ]),
    ).toBeNull()
    expect(calcularDrawdownMaximo([cotacao('2020-01-01', '10')])).toBeNull()
  })
})

describe('calcularFaixa52Semanas', () => {
  it('calcula mínima, máxima e posição nos 12 meses anteriores', () => {
    const dados = [
      cotacao('2019-01-01', '5'),
      cotacao('2020-06-01', '10'),
      cotacao('2021-01-01', '20'),
      cotacao('2021-06-01', '15'),
    ]
    expect(calcularFaixa52Semanas(dados)).toEqual({
      minima: 10,
      maxima: 20,
      posicao: 0.5,
    })
  })

  it('usa posição 0.5 quando a faixa tem um único preço repetido', () => {
    expect(
      calcularFaixa52Semanas([
        cotacao('2020-06-01', '10'),
        cotacao('2021-06-01', '10'),
      ]),
    ).toEqual({ minima: 10, maxima: 10, posicao: 0.5 })
  })

  it('retorna null sem série alta suficiente', () => {
    expect(calcularFaixa52Semanas([])).toBeNull()
    expect(calcularFaixa52Semanas([cotacao('2020-01-01', '10')])).toBeNull()
    expect(
      calcularFaixa52Semanas([
        cotacao('2009-01-01', '10', 'baixa'),
        cotacao('2009-06-01', '20', 'baixa'),
      ]),
    ).toBeNull()
  })
})
