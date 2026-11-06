import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { Button } from '../components'
import { Input } from '../components'

export function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm mx-auto">
        {/* Brand header */}
        <header className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-surface-card flex items-center justify-center mb-3 border border-border-subtle shadow-lg overflow-hidden">
            <img src="/favicon.svg" alt="Meus Ativos" className="w-12 h-12" />
          </div>
          <h1 className="font-display font-semibold text-3xl text-text-primary tracking-tight">Meus Ativos</h1>
          <p className="font-body text-sm text-text-secondary mt-1">Gestão inteligente de Renda Variável</p>
        </header>

        {/* Auth card */}
        <section className="bg-surface-card rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-border-subtle">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary font-body text-xs font-medium tracking-widest uppercase flex items-center gap-1" htmlFor="email">
                <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="seu.email@exemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-12 px-4 rounded-xl bg-bg-base border border-border-subtle text-text-primary font-body text-sm placeholder:text-text-tertiary focus:outline-none focus:border-yield transition-colors"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary font-body text-xs font-medium tracking-widest uppercase flex items-center gap-1" htmlFor="password">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-12 px-4 rounded-xl bg-bg-base border border-border-subtle text-text-primary font-body text-sm placeholder:text-text-tertiary focus:outline-none focus:border-yield transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-alert font-body text-xs">{error}</p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full mt-1 flex items-center justify-center gap-2"
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
              {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
            </Button>
          </form>
        </section>

        {/* Toggle mode */}
        <footer className="flex items-center justify-center gap-1.5 mt-6 font-body text-sm text-text-secondary">
          {mode === 'login' ? (
            <>
              <span>Não tem conta?</span>
              <button
                onClick={() => { setMode('signup'); setError('') }}
                className="text-yield font-medium underline decoration-yield/40 hover:decoration-yield transition-all"
              >
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              <span>Já tem conta?</span>
              <button
                onClick={() => { setMode('login'); setError('') }}
                className="text-yield font-medium underline decoration-yield/40 hover:decoration-yield transition-all"
              >
                Entrar
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
