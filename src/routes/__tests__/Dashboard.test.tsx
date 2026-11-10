import { act, cloneElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../Dashboard'
import { neonFetch } from '../../lib/neon'
import type { CotacaoAjustada } from '../../core/ativoHistorico'
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

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children, { width: 800, height: 360 }),
  }
})

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const mockNeonFetch = vi.mocked(neonFetch)
const roots: Array<{ root: Root; container: HTMLElement }> = []

function transacao(
  id: string,
  ativoTicker: string,
  data: string,
  quantidade: number,
): TransacaoRow {
  return {
    id,
    userId: 'user-1',
    ativoTicker,
    data,
    valorUnitario: '10',
    quantidade,
  }
}

function cotacao(
  ativoTicker: string,
  data: string,
  precoBruto: string,
  precoAjustado: string,
): CotacaoAjustada {
  return {
    ativoTicker,
    data,
    preco_bruto: precoBruto,
    preco_ajustado: precoAjustado,
    fator_divisor: '1',
    confiabilidade: 'alta',
  }
}

function mockApi(
  transacoes: TransacaoRow[],
  ativos: Array<{ ticker: string; tickerCotacao: string; tipo: 'ACAO' | 'FII' }>,
  cotacoes: CotacaoAjustada[],
) {
  mockNeonFetch.mockImplementation((async (path: string) => {
    if (path.startsWith('/transacoes')) return transacoes
    if (path.startsWith('/ativos')) return ativos
    if (path.startsWith('/cotacoes_ajustadas')) return cotacoes
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

function renderDashboard(): Promise<HTMLElement> {
  return renderizar(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

function textoNormalizado(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/ /g, ' ')
}

function caminhosChamados(): string[] {
  return mockNeonFetch.mock.calls.map(([path]) => path)
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

describe('Dashboard — cotações ajustadas', () => {
  it('consulta cotacoes_ajustadas com os tickers únicos e usa preco_ajustado', async () => {
    mockApi(
      [
        transacao('tx-1', 'VALE3', '2019-01-02', 1),
        transacao('tx-2', 'VALE3', '2020-01-02', 1),
        transacao('tx-3', 'PETR4', '2020-01-02', 1),
      ],
      [
        { ticker: 'VALE3', tickerCotacao: 'VALE3', tipo: 'ACAO' },
        { ticker: 'PETR4', tickerCotacao: 'PETR4', tipo: 'ACAO' },
      ],
      [
        // Ordem ascendente; o preço mais recente é o que deve valer.
        cotacao('VALE3', '2019-01-02', '80', '40'),
        cotacao('VALE3', '2026-01-02', '100', '50'),
        cotacao('PETR4', '2026-01-02', '30', '30'),
      ],
    )

    const container = await renderDashboard()

    expect(mockNeonFetch).toHaveBeenCalledWith(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3,PETR4)&order=data.asc',
      'jwt',
    )
    expect(
      caminhosChamados().some((path) => path.startsWith('/cotacoes?')),
    ).toBe(false)
    expect(mockNeonFetch).toHaveBeenCalledTimes(3)

    // VALE3: 2 ações × 50 (ajustado mais recente) + PETR4: 1 × 30 = 130.
    expect(textoNormalizado(container)).toContain('R$ 130,00')
  })

  it('não consulta cotações quando o usuário não tem transações', async () => {
    mockApi([], [], [])

    const container = await renderDashboard()
    const paths = caminhosChamados()

    expect(paths.some((path) => path.startsWith('/cotacoes_ajustadas'))).toBe(false)
    expect(paths.some((path) => path.startsWith('/cotacoes?'))).toBe(false)
    expect(textoNormalizado(container)).toContain('R$ 0,00')
  })

  it('com um único ticker, consulta apenas esse ticker', async () => {
    mockApi(
      [transacao('tx-1', 'VALE3', '2020-01-02', 1)],
      [{ ticker: 'VALE3', tickerCotacao: 'VALE3', tipo: 'ACAO' }],
      [cotacao('VALE3', '2026-01-02', '50', '50')],
    )

    await renderDashboard()

    expect(mockNeonFetch).toHaveBeenCalledWith(
      '/cotacoes_ajustadas?ativoTicker=in.(VALE3)&order=data.asc',
      'jwt',
    )
  })
})
