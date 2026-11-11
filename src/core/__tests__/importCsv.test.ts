import {
  COLUNAS_IMPORTACAO,
  LINHA_EXEMPLO_IMPORTACAO,
  importarCsv,
  modeloImportacaoCsv,
  type AtivoImportacao,
} from '../importCsv'
import type { TransacaoExistenteImportacao } from '../importCsv'

const ativos: AtivoImportacao[] = [
  { ticker: 'ITSA4F', tipo: 'ACAO' },
  { ticker: 'SAPR4F', tipo: 'ACAO' },
  { ticker: 'HGLG11', tipo: 'FII' },
]

const cabecalho = 'DATA;TICKER;VALOR;QUANTIDADE'

function csv(...linhas: string[]): string {
  return [cabecalho, ...linhas].join('\n')
}

function existente(
  overrides: Partial<TransacaoExistenteImportacao> = {},
): TransacaoExistenteImportacao {
  return {
    ativoTicker: 'ITSA4F',
    data: '2023-09-11',
    valorUnitario: '9.070000',
    quantidade: 22,
    ...overrides,
  }
}

describe('importarCsv — arquivo válido', () => {
  it('lê o modelo com ponto e vírgula e vírgula decimal', () => {
    const resultado = importarCsv(
      csv(
        '2023-09-11;ITSA4F;9,07;22',
        '2023-09-11;SAPR4F;4,65;43',
      ),
      ativos,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.duplicadas).toEqual([])
    expect(resultado.linhas).toEqual([
      {
        linha: 2,
        ativoTicker: 'ITSA4F',
        tipo: 'ACAO',
        data: '2023-09-11',
        valorUnitario: '9.07',
        quantidade: 22,
      },
      {
        linha: 3,
        ativoTicker: 'SAPR4F',
        tipo: 'ACAO',
        data: '2023-09-11',
        valorUnitario: '4.65',
        quantidade: 43,
      },
    ])
  })

  it('infere o tipo do cadastro de ativos (não do CSV)', () => {
    const resultado = importarCsv(csv('2023-09-11;HGLG11;9,07;22'), ativos)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas[0]).toMatchObject({
      ativoTicker: 'HGLG11',
      tipo: 'FII',
    })
  })

  it('aceita BOM, CRLF, cabeçalho e campos em minúsculas', () => {
    const texto =
      '﻿data;ticker;valor;quantidade\r\n' +
      '2023-09-11;itsa4f;9,07;22\r\n'

    const resultado = importarCsv(texto, ativos)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas[0]).toMatchObject({
      ativoTicker: 'ITSA4F',
      tipo: 'ACAO',
    })
  })

  it('aceita ponto como separador decimal e espaços ao redor dos campos', () => {
    const resultado = importarCsv(
      csv(' 2023-09-11 ; ITSA4F ; 9.07 ; 22 '),
      ativos,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas[0]).toMatchObject({
      data: '2023-09-11',
      ativoTicker: 'ITSA4F',
      valorUnitario: '9.07',
      quantidade: 22,
    })
  })

  it('ignora linhas em branco mantendo a numeração original', () => {
    const texto = [cabecalho, '', '2023-09-11;ITSA4F;9,07;22', '', ''].join(
      '\n',
    )

    const resultado = importarCsv(texto, ativos)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas).toHaveLength(1)
    expect(resultado.linhas[0].linha).toBe(3)
  })

  it('aceita campos entre aspas com separador dentro', () => {
    const resultado = importarCsv(
      csv('"2023-09-11";"ITSA4F";"9,07";"22"'),
      ativos,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas[0].ativoTicker).toBe('ITSA4F')
  })
})

describe('importarCsv — cabeçalho e arquivo', () => {
  it('rejeita arquivo vazio', () => {
    const resultado = importarCsv('', ativos)

    expect(resultado.linhas).toEqual([])
    expect(resultado.erros).toEqual([{ linha: 1, mensagem: 'Arquivo vazio.' }])
  })

  it('rejeita cabeçalho fora do modelo', () => {
    const resultado = importarCsv(
      'data,ticker,valor,quantidade\n2023-09-11,ITSA4F,9.07,22',
      ativos,
    )

    expect(resultado.linhas).toEqual([])
    expect(resultado.erros[0]).toEqual({
      linha: 1,
      mensagem: `Cabeçalho inválido. Esperado: ${COLUNAS_IMPORTACAO.join(';')}.`,
    })
  })

  it('rejeita aspas não fechadas', () => {
    const resultado = importarCsv(
      csv('2023-09-11;"ITSA4F;9,07;22'),
      ativos,
    )

    expect(resultado.linhas).toEqual([])
    expect(resultado.erros[0].mensagem).toBe(
      'Aspas não fechadas no arquivo.',
    )
  })

  it('rejeita linha com número de colunas diferente de quatro', () => {
    const resultado = importarCsv(csv('2023-09-11;ITSA4F;9,07'), ativos)

    expect(resultado.erros).toEqual([
      {
        linha: 2,
        mensagem: 'Número de colunas inválido: esperado 4, recebido 3.',
      },
    ])
  })
})

describe('importarCsv — linhas inválidas bloqueiam o arquivo', () => {
  it('reporta cada campo inválido com a linha correta e preserva as válidas', () => {
    const resultado = importarCsv(
      csv(
        '2023-09-11;ITSA4F;9,07;22',
        '2023-02-30;ITSA4F;9,07;22',
        '2023-09-11;XPTO;9,07;22',
        '2023-09-11;ITSA4F;abc;22',
        '2023-09-11;ITSA4F;0;22',
        '2023-09-11;ITSA4F;9,07;1,5',
        '2023-09-11;ITSA4F;9,07;0',
      ),
      ativos,
    )

    expect(resultado.linhas).toHaveLength(1)
    expect(resultado.erros).toEqual([
      { linha: 3, mensagem: 'DATA inválida: "2023-02-30". Use AAAA-MM-DD.' },
      { linha: 4, mensagem: 'TICKER não encontrado no cadastro: XPTO.' },
      { linha: 5, mensagem: 'VALOR inválido: "abc".' },
      { linha: 6, mensagem: 'VALOR deve ser maior que zero.' },
      {
        linha: 7,
        mensagem: 'QUANTIDADE deve ser um número inteiro maior que zero.',
      },
      {
        linha: 8,
        mensagem: 'QUANTIDADE deve ser um número inteiro maior que zero.',
      },
    ])
  })

  it('rejeita valor com vírgula e ponto, ou com mais de 6 casas decimais', () => {
    const resultado = importarCsv(
      csv(
        '2023-09-11;ITSA4F;1.234,56;22',
        '2023-09-11;ITSA4F;9,0700001;22',
        '2023-09-11;ITSA4F;;22',
      ),
      ativos,
    )

    expect(resultado.erros).toEqual([
      {
        linha: 2,
        mensagem:
          'VALOR inválido: "1.234,56". Use vírgula ou ponto decimal, não ambos.',
      },
      { linha: 3, mensagem: 'VALOR tem mais de 6 casas decimais.' },
      { linha: 4, mensagem: 'VALOR vazio.' },
    ])
  })

  it('rejeita ticker vazio e valores acima do limite do banco', () => {
    const resultado = importarCsv(
      csv(
        '2023-09-11;;9,07;22',
        '2023-09-11;ITSA4F;9999999999999;22',
        '2023-09-11;ITSA4F;9,07;2147483648',
      ),
      ativos,
    )

    expect(resultado.erros).toEqual([
      { linha: 2, mensagem: 'TICKER vazio.' },
      { linha: 3, mensagem: 'VALOR excede o limite permitido.' },
      { linha: 4, mensagem: 'QUANTIDADE excede o limite permitido.' },
    ])
  })
})

describe('importarCsv — duplicatas', () => {
  it('ignora transação já existente comparando o valor numérico', () => {
    const resultado = importarCsv(
      csv('2023-09-11;ITSA4F;9,07;22'),
      ativos,
      [existente()],
    )

    expect(resultado.linhas).toEqual([])
    expect(resultado.erros).toEqual([])
    expect(resultado.duplicadas).toEqual([{ linha: 2, motivo: 'existente' }])
  })

  it('importa a primeira ocorrência e ignora as repetições do arquivo', () => {
    const resultado = importarCsv(
      csv(
        '2023-09-11;ITSA4F;9,07;22',
        '2023-09-11;ITSA4F;9,070000;22',
        '2023-09-11;SAPR4F;4,65;43',
      ),
      ativos,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas.map((linha) => linha.ativoTicker)).toEqual([
      'ITSA4F',
      'SAPR4F',
    ])
    expect(resultado.duplicadas).toEqual([{ linha: 3, motivo: 'arquivo' }])
  })

  it('não confunde transações com data ou quantidade diferentes', () => {
    const resultado = importarCsv(
      csv(
        '2023-09-12;ITSA4F;9,07;22',
        '2023-09-11;ITSA4F;9,07;23',
        '2023-09-11;SAPR4F;9,07;22',
      ),
      ativos,
      [existente()],
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas).toHaveLength(3)
    expect(resultado.duplicadas).toEqual([])
  })
})

describe('modeloImportacaoCsv', () => {
  it('tem BOM, o cabeçalho exigido e quebra de linha final', () => {
    expect(modeloImportacaoCsv()).toBe(
      '﻿DATA;TICKER;VALOR;QUANTIDADE\n',
    )
  })

  it('linha de exemplo usa o mesmo formato do modelo', () => {
    const exemplo = importarCsv(
      `${cabecalho}\n${LINHA_EXEMPLO_IMPORTACAO}`,
      ativos,
    )

    expect(exemplo.erros).toEqual([])
    expect(exemplo.linhas).toHaveLength(1)
  })
})
