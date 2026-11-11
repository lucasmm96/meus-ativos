import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AtivosExplorer } from '../AtivosExplorer'
import { neonFetch } from '../../lib/neon'
import type { AtivoResumo } from '../../core/ativosExplorer'

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
const roots: Array<{ root: Root; container: HTMLElement }> = []

const ativos: AtivoResumo[] = [
  {
    ticker: 'ITUB4',
    nome: 'Itaú Unibanco',
    tipo: 'ACAO',
    data_ultima: '2026-11-06',
    preco_atual: '36.5',
    maxima_52s: '40',
    minima_52s: '30',
    preco_12m: '33',
    retorno_12m: '0.106061',
  },
  {
    ticker: 'PETR4',
    nome: 'Petróleo Brasileiro',
    tipo: 'ACAO',
    data_ultima: '2026-11-06',
    preco_atual: '40',
    maxima_52s: '45',
    minima_52s: '35',
    preco_12m: '42',
    retorno_12m: '-0.05',
  },
  {
    ticker: 'MXRF11',
    nome: 'Maxi Renda',
    tipo: 'FII',
    data_ultima: '2026-11-06',
    preco_atual: '10',
    maxima_52s: null,
    minima_52s: null,
    preco_12m: null,
    retorno_12m: null,
  },
]

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

function renderExplorer(): Promise<HTMLElement> {
  return renderizar(
    <MemoryRouter>
      <AtivosExplorer />
    </MemoryRouter>,
  )
}

function links(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>('a[href^="/ativos/"]'),
  ).map((link) => link.getAttribute('href') ?? '')
}

async function digitar(container: HTMLElement, valor: string): Promise<void> {
  const input = container.querySelector('#busca-ativos') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  await act(async () => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function clicar(container: HTMLElement, texto: string): Promise<void> {
  const botao = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  ) as HTMLButtonElement | undefined
  if (!botao) throw new Error(`botão não encontrado: ${texto}`)
  await act(async () => {
    botao.click()
  })
}

async function selecionar(container: HTMLElement, valor: string): Promise<void> {
  const select = container.querySelector('#ordem-ativos') as HTMLSelectElement
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value',
  )?.set
  await act(async () => {
    setter?.call(select, valor)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

beforeEach(() => {
  mockNeonFetch.mockReset()
})

afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('AtivosExplorer', () => {
  it('carrega a view ativos_resumo e lista os ativos com link para o detalhe', async () => {
    mockNeonFetch.mockImplementation((async () => ativos) as never)
    const container = await renderExplorer()

    expect(mockNeonFetch).toHaveBeenCalledWith(
      '/ativos_resumo?select=ticker,nome,tipo,data_ultima,preco_atual,maxima_52s,minima_52s,preco_12m,retorno_12m',
      'jwt',
    )
    const texto = container.textContent ?? ''
    expect(texto).toContain('3 de 3 ativos')
    expect(texto).toContain('ITUB4')
    expect(texto).toContain('Itaú Unibanco')
    expect(texto).toContain('MXRF11')
    expect(links(container)).toEqual([
      '/ativos/ITUB4',
      '/ativos/MXRF11',
      '/ativos/PETR4',
    ])
  })

  it('busca por nome sem acento e por ticker', async () => {
    mockNeonFetch.mockImplementation((async () => ativos) as never)
    const container = await renderExplorer()

    await digitar(container, 'petroleo')
    expect(container.textContent).toContain('1 de 3 ativos')
    expect(links(container)).toEqual(['/ativos/PETR4'])

    await digitar(container, 'mxrf')
    expect(links(container)).toEqual(['/ativos/MXRF11'])
  })

  it('filtra ações e FIIs', async () => {
    mockNeonFetch.mockImplementation((async () => ativos) as never)
    const container = await renderExplorer()

    await clicar(container, 'FIIs')
    expect(container.textContent).toContain('1 de 3 ativos')
    expect(links(container)).toEqual(['/ativos/MXRF11'])

    await clicar(container, 'Ações')
    expect(container.textContent).toContain('2 de 3 ativos')
    expect(links(container)).toEqual(['/ativos/ITUB4', '/ativos/PETR4'])
  })

  it('ordena por retorno 12m, deixando nulos por último, e por ticker', async () => {
    mockNeonFetch.mockImplementation((async () => ativos) as never)
    const container = await renderExplorer()

    await selecionar(container, 'retorno12m')
    expect(links(container)).toEqual([
      '/ativos/ITUB4',
      '/ativos/PETR4',
      '/ativos/MXRF11',
    ])

    await selecionar(container, 'ticker')
    expect(links(container)).toEqual([
      '/ativos/ITUB4',
      '/ativos/MXRF11',
      '/ativos/PETR4',
    ])
  })

  it('mostra estado vazio quando nenhum ativo casa com os filtros', async () => {
    mockNeonFetch.mockImplementation((async () => ativos) as never)
    const container = await renderExplorer()

    await digitar(container, 'inexistente')
    expect(container.textContent).toContain('0 de 3 ativos')
    expect(container.textContent).toContain(
      'Nenhum ativo encontrado para os filtros atuais.',
    )
  })

  it('mostra estado vazio quando o banco não tem ativos', async () => {
    mockNeonFetch.mockImplementation((async () => []) as never)
    const container = await renderExplorer()

    expect(container.textContent).toContain('0 de 0 ativos')
    expect(container.textContent).toContain(
      'Nenhum ativo disponível no banco.',
    )
  })

  it('mostra erro de carregamento', async () => {
    mockNeonFetch.mockImplementation((async () => { throw new Error('Neon API error 500') }) as never)
    const container = await renderExplorer()

    expect(container.textContent).toContain('Neon API error 500')
  })
})
