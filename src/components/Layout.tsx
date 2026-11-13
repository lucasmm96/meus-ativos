import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const TABS = [
  { path: '/',             label: 'Início',       icon: 'home'              },
  { path: '/ativos',       label: 'Ativos',        icon: 'candlestick_chart' },
  { path: '/transactions', label: 'Movimentações', icon: 'receipt_long'      },
  { path: '/perfil',       label: 'Perfil',        icon: 'person'            },
] as const

function isActive(pathname: string, tabPath: string): boolean {
  if (tabPath === '/') return pathname === '/'
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`)
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-surface-card border-b border-border-subtle
                         px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <img src="/favicon.svg" alt="Meus Ativos" className="w-7 h-7" />
          <span className="font-display font-semibold text-text-primary text-lg">Meus Ativos</span>
        </div>

        <nav className="hidden sm:flex items-center gap-1" aria-label="Navegação principal">
          {TABS.map(tab => {
            const active = isActive(pathname, tab.path)
            return (
              <Link
                key={tab.path}
                to={tab.path}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm font-medium transition-colors
                  ${active
                    ? 'text-text-primary bg-surface-elevated'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'}`}
              >
                <span className="material-symbols-outlined text-[18px] leading-none">{tab.icon}</span>
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={signOut}
          aria-label="Sair da conta"
          className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl
                     text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">logout</span>
        </button>
      </header>

      <div className="pb-20 sm:pb-0">{children}</div>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-surface-card border-t border-border-subtle"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegação por abas"
      >
        <div className="flex">
          {TABS.map(tab => {
            const active = isActive(pathname, tab.path)
            return (
              <Link
                key={tab.path}
                to={tab.path}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors
                  ${active ? 'text-equity' : 'text-text-secondary hover:text-text-primary'}`}
              >
                <span
                  className="material-symbols-outlined text-[24px] leading-none"
                  style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
                >
                  {tab.icon}
                </span>
                <span className="font-body text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}