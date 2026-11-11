import { act, cloneElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AtivoHistorico } from '../AtivoHistorico'
import { AllocationBar } from '../../components/charts/AllocationBar'
import { AllocationPie } from '../../components/charts/AllocationPie'
import { neonFetch } from '../../lib/neon'
import type { CotacaoAjustada, EventoCorporativo } from '../../core/ativoHistorico'
import type { ResultadoAtivo } from '../../core/types'

// `user` precisa ser estável entre renders: o componente usa `[user, ticker]`
// como dependência do efeito, e um objeto novo a cada render causaria loop.
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

function cotacao(
  ativoTicker: string,
  data: string,
  preco: string,
  confiabilidade: 'alta' | 'baixa',
  fator = '1',
  precoAjustado = preco,
): CotacaoAjustada {
  return {
    ativoTicker,
    data,
    preco_bruto: preco,
    preco_ajustado: precoAjustado,
    fator_divisor: fator,
    confiabilidade,
  }
}

function evento(
  tipo: EventoCorporativo['tipo'],
  data: string,
  fator: number | null = null,
): EventoCorporativo {
  return {
    tipo,
    data_efetiva: data,
    descricao: null,
    ticker_relacionado: null,
    fator_ajuste: fator,
  }
}

function mockApi(
  cotacoes: CotacaoAjustada[],
  eventos: EventoCorporativo[],
  ativo: { ticker: string; nome: string; tipo: 'ACAO' | 'FII'; tickerCotacao?: string } | null,
) {
  mockNeonFetch.mockImplementation((async (path: string) => {
    if (path.startsWith('/cotacoes_ajustadas')) return cotacoes
    if (path.startsWith('/eventos_corporativos')) return eventos
    if (path.startsWith('/ativos')) {
      if (!ativo) return []
      return [{ tickerCotacao: ativo.ticker, ...ativo }]
    }
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
  // Flush das promises do fetch mockado e do setState subsequente.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return container
}

function renderRoute(ticker: string): Promise<HTMLElement> {
  return renderizar(
    <MemoryRouter initialEntries={[`/ativos/${ticker}`]}>
      <Routes>
        <Route path="/ativos/:ticker" element={<AtivoHistorico />} />
      </Routes>
    </MemoryRouter>,
  )
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

describe('AtivoHistorico', () => {
  it('ITUB4 mostra badge de série ajustada, split e linha de 2010, sem aviso amarelo', async () => {
    mockApi(
      [
        cotacao('ITUB4', '2009-12-30', '30.00', 'baixa'),
        // Valores reais do banco: o split de 2018 é compensado em preco_ajustado.
        cotacao('ITUB4', '2018-11-19', '52.72', 'alta', '1.545', '34.122977'),
        cotacao('ITUB4', '2018-11-21', '34.69', 'alta', '1.03', '33.679612'),
        cotacao('ITUB4', '2026-11-06', '40.00', 'alta', '1'),
      ],
      [
        evento('SPLIT', '2018-11-21', 1.5),
        evento('BONIFICACAO', '2025-12-26', 1.03),
      ],
      { ticker: 'ITUB4', nome: 'ITAU UNIBANCO', tipo: 'ACAO' },
    )

    const container = await renderRoute('ITUB4')
    expect(mockNeonFetch).toHaveBeenCalledTimes(3)
    const texto = container.textContent ?? ''

    expect(texto).toContain('Série ajustada')
    expect(texto).toContain('Split')
    expect(texto).toContain('Início da série ajustada')
    expect(texto).not.toContain('Série pode não estar ajustada')
    expect(texto).not.toContain('Eventos corporativos para FIIs')
    expect(texto).toContain('Apenas desdobramentos automáticos registrados')

    // Há um ponto pré-2010 (`baixa`): trecho tracejado; e linha sólida pós-2010.
    expect(container.querySelector('path[stroke-dasharray="4 4"]')).not.toBeNull()
    expect(
      container.querySelector('path.recharts-line-curve[stroke="#6cba3b"]'),
    ).not.toBeNull()

    // Tooltip dos ReferenceLines de evento: tipo humanizado + data.
    const titulos = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    )
    expect(titulos).toContain('Split 1:1.5 em 21/11/2018')
    expect(titulos).toContain('Bonificação 1:1.03 em 26/12/2025')
  })

  it('tooltip sem fator mostra apenas tipo e data', async () => {
    mockApi(
      [
        cotacao('ITUB4', '2018-11-19', '52.72', 'alta', '1.545', '34.122977'),
        cotacao('ITUB4', '2018-11-21', '34.69', 'alta', '1.03', '33.679612'),
        cotacao('ITUB4', '2026-11-06', '40.00', 'alta', '1'),
      ],
      [evento('SPLIT', '2018-11-21')],
      { ticker: 'ITUB4', nome: 'ITAU UNIBANCO', tipo: 'ACAO' },
    )

    const container = await renderRoute('ITUB4')
    const titulos = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    )
    expect(titulos).toContain('Split em 21/11/2018')
    expect(titulos).not.toContain('Split 1:1.5 em 21/11/2018')
  })

  it('grupamento inverte o fator no tooltip', async () => {
    mockApi(
      [
        cotacao('TCSA3', '2025-01-02', '10', 'alta'),
        cotacao('TCSA3', '2026-11-03', '1', 'alta', '0.1'),
        cotacao('TCSA3', '2026-11-06', '1.1', 'alta', '0.1'),
      ],
      [evento('GRUPAMENTO', '2026-11-03', 0.1)],
      { ticker: 'TCSA3', nome: 'TECNISA', tipo: 'ACAO' },
    )

    const container = await renderRoute('TCSA3')
    const titulos = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    )
    expect(titulos).toContain('Grupamento 10:1 em 03/11/2026')
  })

  it('filtros de período atualizam a série e os eventos visíveis', async () => {
    mockApi(
      [
        cotacao('ITUB4', '2009-12-30', '30.00', 'baixa'),
        cotacao('ITUB4', '2018-11-21', '33.68', 'alta', '1.03'),
        cotacao('ITUB4', '2025-12-26', '38.00', 'alta', '1.03'),
        cotacao('ITUB4', '2026-11-06', '40.00', 'alta', '1'),
      ],
      [evento('SPLIT', '2018-11-21'), evento('BONIFICACAO', '2025-12-26')],
      { ticker: 'ITUB4', nome: 'ITAU UNIBANCO', tipo: 'ACAO' },
    )

    const container = await renderRoute('ITUB4')
    expect(container.textContent).toContain('Split · 21/11/2018')

    async function clicar(texto: string): Promise<HTMLButtonElement> {
      const botao = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === texto,
      ) as HTMLButtonElement | undefined
      if (!botao) throw new Error(`filtro não encontrado: ${texto}`)
      await act(async () => {
        botao.click()
      })
      return botao
    }

    // 1M/6M/1A/5A excluem o split de 2018; 1A e 5A incluem a bonificação de 2025.
    await clicar('1M')
    expect(container.textContent).not.toContain('Split · 21/11/2018')
    expect(container.textContent).not.toContain('Bonificação · 26/12/2025')

    await clicar('6M')
    expect(container.textContent).not.toContain('Split · 21/11/2018')

    const botao1A = await clicar('1A')
    expect(botao1A.className).toContain('bg-equity')
    expect(container.textContent).not.toContain('Split · 21/11/2018')
    expect(container.textContent).toContain('Bonificação · 26/12/2025')

    await clicar('5A')
    expect(container.textContent).not.toContain('Split · 21/11/2018')
    expect(container.textContent).toContain('Bonificação · 26/12/2025')

    await clicar('Tudo')
    expect(container.textContent).toContain('Split · 21/11/2018')
    expect(container.textContent).toContain('Bonificação · 26/12/2025')
  })

  it('exibe fechamento, faixa de 52 semanas, drawdown e retornos por período', async () => {
    mockApi(
      [
        cotacao('WEGE3', '2024-06-03', '10', 'alta'),
        cotacao('WEGE3', '2024-12-02', '20', 'alta'),
        cotacao('WEGE3', '2025-01-06', '15', 'alta'),
        cotacao('WEGE3', '2026-01-05', '25', 'alta'),
        cotacao('WEGE3', '2026-11-06', '30', 'alta'),
      ],
      [],
      { ticker: 'WEGE3', nome: 'WEG', tipo: 'ACAO' },
    )

    const container = await renderRoute('WEGE3')
    const texto = container.textContent ?? ''

    expect(texto).toContain('Fechamento mais recente')
    expect(texto).toContain('30,00')
    expect(texto).toContain('Faixa de 52 semanas')
    expect(texto).toContain('25,00')
    expect(texto).toContain('Drawdown máximo')
    // Pico de 20 em 2024-12-02 → fundo de 15 em 2025-01-06: -25%.
    expect(texto).toContain('-25,00%')
    expect(texto).toContain('Retorno por período')
    // 1A: 25 → 30 = +20%; 5A e Tudo: 10 → 30 = +200%.
    expect(texto).toContain('20,00%')
    expect(texto).toContain('200,00%')
  })

  it('ticker antigo sem eventos mostra aviso amarelo e trecho tracejado pré-2010', async () => {
    mockApi(
      [
        cotacao('ABCB4', '2008-06-02', '10', 'baixa'),
        cotacao('ABCB4', '2009-12-31', '12', 'baixa'),
        cotacao('ABCB4', '2010-01-04', '13', 'alta'),
        cotacao('ABCB4', '2026-11-06', '20', 'alta'),
      ],
      [],
      { ticker: 'ABCB4', nome: 'ABC BRASIL', tipo: 'ACAO' },
    )

    const container = await renderRoute('ABCB4')
    const texto = container.textContent ?? ''

    expect(texto).toContain(
      'Série pode não estar ajustada. Eventos corporativos históricos para este ativo não foram verificados.',
    )
    expect(texto).toContain('Início da série ajustada')
    expect(texto).toContain(
      'Apenas desdobramentos automáticos registrados. Outros eventos corporativos podem estar ausentes.',
    )
    expect(
      container.querySelector('path[stroke-dasharray="4 4"]'),
    ).not.toBeNull()
  })

  it('MXRF11 mostra badge específico de FII e não mostra aviso amarelo genérico', async () => {
    mockApi(
      [
        cotacao('MXRF11', '2015-01-02', '10', 'alta'),
        cotacao('MXRF11', '2026-11-06', '11', 'alta'),
      ],
      [],
      { ticker: 'MXRF11', nome: 'Maxi Renda', tipo: 'FII' },
    )

    const container = await renderRoute('MXRF11')
    const texto = container.textContent ?? ''

    expect(texto).toContain(
      'Eventos corporativos para FIIs não são cobertos por fontes gratuitas. A série exibida é bruta, sem ajuste por eventos.',
    )
    expect(texto).toContain('Série bruta — sem ajuste por eventos')
    expect(texto).not.toContain('Série pode não estar ajustada')
  })

  it('ticker alias: busca cotações pelo tickerCotacao e eventos para ambos os tickers', async () => {
    // CPLE6 é alias de CPLE3; cotações estão armazenadas sob CPLE3.
    mockApi(
      [cotacao('CPLE3', '2026-01-02', '12', 'alta')],
      [evento('SPLIT', '2021-10-04', 10)],
      { ticker: 'CPLE6', nome: 'Copel PN', tipo: 'ACAO', tickerCotacao: 'CPLE3' },
    )

    await renderRoute('CPLE6')

    const paths = mockNeonFetch.mock.calls.map(([path]) => path)
    expect(paths.some((p) => p.includes('ativoTicker=eq.CPLE3'))).toBe(true)
    expect(paths.some((p) => p.includes('ativoTicker=eq.CPLE6'))).toBe(false)
    expect(paths.some((p) => p.includes('ticker=in.(CPLE6,CPLE3)'))).toBe(true)
  })
})

describe('links do Dashboard para /ativos/:ticker', () => {
  const resultado: ResultadoAtivo = {
    ticker: 'ITUB4',
    tickerCotacao: 'ITUB4',
    tipo: 'ACAO',
    quantidadeTotal: 10,
    precoMedio: '30',
    valorInvestido: '300',
    valorMercado: '400',
    pnl: '100',
    pnlPercent: '33.3',
  }

  it('AllocationPie expõe link para o ticker de cotação', async () => {
    const container = await renderizar(
      <MemoryRouter>
        <AllocationPie resultados={[resultado]} mode="valor" />
      </MemoryRouter>,
    )

    expect(
      container.querySelector('a[href="/ativos/ITUB4"]'),
    ).not.toBeNull()
  })

  it('AllocationBar expõe link acessível no eixo do ticker', async () => {
    const container = await renderizar(
      <MemoryRouter>
        <AllocationBar resultados={[resultado]} mode="valor" />
      </MemoryRouter>,
    )

    expect(
      container.querySelector(
        'a[aria-label="Abrir histórico de ITUB4"][href="/ativos/ITUB4"]',
      ),
    ).not.toBeNull()
  })
})
