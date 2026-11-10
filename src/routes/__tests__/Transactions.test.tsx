import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Transactions } from '../Transactions'
import { neonFetch, neonMutate } from '../../lib/neon'
import type { EventoAjuste } from '../../core/ajustarTransacoes'
import type { TransacaoRow } from '../../core/types'

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: 'user-1', email: 'user@example.com', jwt: 'jwt' },
}))

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('../../lib/neon', () => ({
  neonFetch: vi.fn(),
  neonMutate: vi.fn(),
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const mockNeonFetch = vi.mocked(neonFetch)
const mockNeonMutate = vi.mocked(neonMutate)
const roots: Array<{ root: Root; container: HTMLElement }> = []

function transacao(overrides: Partial<TransacaoRow> = {}): TransacaoRow {
  return {
    id: 'tx-1',
    userId: 'user-1',
    ativoTicker: 'BBAS3',
    data: '2023-01-02',
    valorUnitario: '25',
    quantidade: 100,
    ajustadaManualmente: false,
    ...overrides,
  }
}

function mockApi(
  transacoes: TransacaoRow[],
  eventos: EventoAjuste[] = [],
  arquivamentos: Array<{ transacaoId: string }> = [],
) {
  mockNeonFetch.mockImplementation((async (path: string) => {
    if (path.startsWith('/transacoes')) return transacoes
    if (path.startsWith('/ativos')) {
      return [
        {
          ticker: 'BBAS3',
          tickerCotacao: 'BBAS3',
          tipo: 'ACAO' as const,
          nome: 'Banco do Brasil',
        },
      ]
    }
    if (path.startsWith('/arquivamentos')) return arquivamentos
    if (path.startsWith('/eventos_corporativos')) return eventos
    throw new Error(`path inesperado: ${path}`)
  }) as never)
}

async function renderizar(elemento: ReactElement): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ root, container })

  await act(async () => {
    root.render(elemento)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return container
}

function renderTransactions(): Promise<HTMLElement> {
  return renderizar(
    <MemoryRouter>
      <Transactions />
    </MemoryRouter>,
  )
}

function textoNormalizado(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/ /g, ' ')
}

function lerBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const bytes = reader.result as ArrayBuffer
      resolve(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

function botao(container: HTMLElement, texto: string): HTMLButtonElement {
  const encontrado = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.includes(texto),
  )
  if (!encontrado) throw new Error(`botão não encontrado: ${texto}`)
  return encontrado as HTMLButtonElement
}

async function clicar(container: HTMLElement, texto: string): Promise<void> {
  await act(async () => {
    botao(container, texto).click()
  })
}

async function alterarCampo(
  elemento: HTMLInputElement | HTMLSelectElement,
  valor: string,
): Promise<void> {
  const proto =
    elemento instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
  await act(async () => {
    setter.call(elemento, valor)
    elemento.dispatchEvent(
      new Event(elemento instanceof HTMLSelectElement ? 'change' : 'input', {
        bubbles: true,
      }),
    )
  })
}

beforeEach(() => {
  mockNeonFetch.mockReset()
  mockNeonMutate.mockReset()
  mockNeonMutate.mockResolvedValue(undefined)
})

afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.restoreAllMocks()
})

describe('Transactions — eventos corporativos e pré-2010', () => {
  it('busca eventos dos tickers das transações', async () => {
    mockApi([transacao()])

    await renderTransactions()

    expect(mockNeonFetch).toHaveBeenCalledWith(
      '/eventos_corporativos?ticker=in.(BBAS3)&tipo=in.(SPLIT,GRUPAMENTO,BONIFICACAO)&select=ticker,data_efetiva,fator_ajuste,tipo&order=data_efetiva.asc',
      'jwt',
    )
  })

  it('não busca eventos quando não há transações', async () => {
    mockApi([])

    await renderTransactions()

    const paths = mockNeonFetch.mock.calls.map(([path]) => path)
    expect(paths.some((path) => path.startsWith('/eventos_corporativos'))).toBe(
      false,
    )
  })

  it('exibe quantidade e preço ajustados com tooltip do valor original', async () => {
    mockApi(
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

    const container = await renderTransactions()
    const texto = textoNormalizado(container)

    expect(texto).toContain('200 ações · R$ 12,50')
    expect(texto).toContain('R$ 2.500,00')
    const comTooltip = container.querySelector('[title^="Original:"]')
    expect(comTooltip?.getAttribute('title')).toBe(
      'Original: 100 ações a R$ 25,00 (antes de splits/grupamentos/bonificações)',
    )
  })

  it('mostra badge Pré-2010 só para data anterior a 2010-01-01', async () => {
    mockApi([
      transacao({ id: 'pre', data: '2009-12-31' }),
      transacao({ id: 'limite', data: '2010-01-01' }),
    ])

    const container = await renderTransactions()
    const texto = container.textContent ?? ''

    expect(texto.match(/Pré-2010/g)).toHaveLength(1)
  })

  it('mostra badge Ajustada manualmente quando a flag está ativa', async () => {
    mockApi([transacao({ ajustadaManualmente: true })])

    const container = await renderTransactions()

    expect(container.textContent).toContain('Ajustada manualmente')
  })
})

describe('Transactions — formulário e override manual', () => {
  it('exibe aviso pré-2010 e permite salvar sem marcar a ciência', async () => {
    mockApi([transacao({ data: '2020-01-02' })])

    const container = await renderTransactions()
    await clicar(container, 'Editar')

    const inputData = container.querySelector('#trade-date') as HTMLInputElement
    await alterarCampo(inputData, '2005-01-01')

    const texto = container.textContent ?? ''
    expect(texto).toContain(
      'dados de eventos corporativos confiáveis a partir de 2010',
    )
    expect(texto).toContain('Entendi, registrar mesmo assim')

    const checkboxes = container.querySelectorAll(
      'form input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>
    expect([...checkboxes].some((c) => c.checked)).toBe(false)

    await clicar(container, 'Salvar Alterações')

    expect(mockNeonMutate).toHaveBeenCalledWith(
      '/transacoes?id=eq.tx-1',
      'jwt',
      expect.objectContaining({ data: '2005-01-01' }),
      'PATCH',
    )
  })

  it('não exibe aviso quando a data é 2010-01-01', async () => {
    mockApi([transacao({ data: '2020-01-02' })])

    const container = await renderTransactions()
    await clicar(container, 'Editar')

    const inputData = container.querySelector('#trade-date') as HTMLInputElement
    await alterarCampo(inputData, '2010-01-01')

    expect(container.textContent).not.toContain('Entendi, registrar mesmo assim')
  })

  it('checkbox de override começa desmarcado e salva ajustadaManualmente=false', async () => {
    mockApi([transacao({ ajustadaManualmente: true })])

    const container = await renderTransactions()
    await clicar(container, 'Editar')

    const checkboxes = container.querySelectorAll(
      'form input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>
    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0].checked).toBe(false)

    await clicar(container, 'Salvar Alterações')

    expect(mockNeonMutate).toHaveBeenCalledWith(
      '/transacoes?id=eq.tx-1',
      'jwt',
      expect.objectContaining({ ajustadaManualmente: false }),
      'PATCH',
    )
  })

  it('marcar o override envia ajustadaManualmente=true', async () => {
    mockApi([transacao({ ajustadaManualmente: false })])

    const container = await renderTransactions()
    await clicar(container, 'Editar')

    const checkbox = container.querySelector(
      'form input[type="checkbox"]',
    ) as HTMLInputElement
    await act(async () => {
      checkbox.click()
    })
    expect(checkbox.checked).toBe(true)

    await clicar(container, 'Salvar Alterações')

    expect(mockNeonMutate).toHaveBeenCalledWith(
      '/transacoes?id=eq.tx-1',
      'jwt',
      expect.objectContaining({ ajustadaManualmente: true }),
      'PATCH',
    )
  })
})

describe('Transactions — export CSV', () => {
  it('baixa CSV com BOM, cabeçalho e nome de arquivo datado', async () => {
    mockApi([transacao({ data: '2009-12-31', quantidade: 10 })])

    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    const container = await renderTransactions()
    const createElementSpy = vi.spyOn(document, 'createElement')
    await clicar(container, 'Exportar CSV')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')

    const conteudo = await lerBlob(blob)
    expect(conteudo.startsWith('﻿')).toBe(true)
    expect(conteudo.replace(/^﻿/, '').split('\n')[0]).toBe(
      'data,ativoTicker,tipo,quantidade,valorUnitario,confiabilidade,aviso',
    )
    expect(conteudo).toContain('2009-12-31,BBAS3,ACAO,10,25,baixa,')

    expect(clickSpy).toHaveBeenCalled()
    const anchor = createElementSpy.mock.results
      .map((resultado) => resultado.value)
      .find(
        (valor): valor is HTMLAnchorElement =>
          valor instanceof HTMLAnchorElement && valor.download !== '',
      )
    expect(anchor?.download).toMatch(/^transacoes-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
