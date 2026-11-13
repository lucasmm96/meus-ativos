import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Layout } from '../Layout'

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: 'user-1', email: 'user@example.com', jwt: 'jwt' },
}))

const signOut = vi.fn()

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut,
  }),
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null

async function renderizar(path: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const r = createRoot(container)
  root = r
  await act(async () => {
    r.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Layout><div data-testid="conteudo">conteúdo</div></Layout>} />
        </Routes>
      </MemoryRouter>,
    )
  })
  return container
}

afterEach(() => {
  root?.unmount()
  root = null
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('Layout', () => {
  it('mostra as 4 abas em ambas as navegações', async () => {
    const container = await renderizar('/')
    const abas = ['Início', 'Ativos', 'Movimentações', 'Perfil']
    for (const aba of abas) {
      expect(container.querySelectorAll(`[aria-label="${aba}"]`).length).toBeGreaterThan(0)
    }
    expect(container.querySelector('[aria-label="Navegação principal"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Navegação por abas"]')).not.toBeNull()
  })

  it('marca a aba ativa pela rota exata', async () => {
    const container = await renderizar('/')
    const ativo = container.querySelector('[aria-label="Início"][aria-current="page"]')
    expect(ativo).not.toBeNull()
    expect(container.querySelector('[aria-label="Ativos"][aria-current="page"]')).toBeNull()
  })

  it('ativa a aba Ativos em /ativos/:ticker', async () => {
    const container = await renderizar('/ativos/VALE3')
    expect(container.querySelector('[aria-label="Ativos"][aria-current="page"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Início"][aria-current="page"]')).toBeNull()
  })

  it('renderiza o conteúdo dentro do shell', async () => {
    const container = await renderizar('/')
    expect(container.querySelector('[data-testid="conteudo"]')?.textContent).toBe('conteúdo')
  })

  it('desloga ao clicar no botão de sair', async () => {
    const container = await renderizar('/')
    const botao = container.querySelector('[aria-label="Sair da conta"]') as HTMLButtonElement
    expect(botao).not.toBeNull()
    botao.click()
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})