import { act, cloneElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EvolutionLine } from '../EvolutionLine'
import type { Confiabilidade } from '../../../core/ativoHistorico'

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

const roots: Array<{ root: Root; container: HTMLElement }> = []

function ponto(
  date: string,
  total: number,
  confiabilidade: Confiabilidade,
) {
  return { date, total, confiabilidade }
}

async function renderizar(elemento: ReactElement): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ root, container })

  await act(async () => {
    root.render(elemento)
  })
  return container
}

async function clicar(container: HTMLElement, texto: string) {
  const botao = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  )
  if (!botao) throw new Error(`botão não encontrado: ${texto}`)
  await act(async () => {
    botao.click()
  })
}

beforeEach(() => {
  roots.length = 0
})

afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('EvolutionLine', () => {
  it('série longa: distingue pré/pós-2010 e marca o início da série ajustada', async () => {
    const container = await renderizar(
      <EvolutionLine
        data={[
          ponto('2009-06-01', 100, 'baixa'),
          ponto('2010-01-04', 110, 'alta'),
          ponto('2026-11-06', 200, 'alta'),
        ]}
      />,
    )

    await clicar(container, 'Tudo')

    expect(
      container.querySelector('path[stroke-dasharray="4 4"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('path.recharts-line-curve[stroke="#6cba3b"]'),
    ).not.toBeNull()
    expect(container.textContent).toContain('Início da série ajustada')
  })

  it('série curta: não aplica distinção de 2010', async () => {
    const container = await renderizar(
      <EvolutionLine
        data={[
          ponto('2026-11-01', 100, 'alta'),
          ponto('2026-11-06', 120, 'alta'),
        ]}
      />,
    )

    expect(container.textContent).not.toContain('Início da série ajustada')
    expect(
      container.querySelector('path[stroke-dasharray="4 4"]'),
    ).toBeNull()
    expect(
      container.querySelector('path.recharts-line-curve[stroke="#6cba3b"]'),
    ).not.toBeNull()
  })
})
