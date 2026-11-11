import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, updateUserName } from '../lib/auth'
import { neonFetch } from '../lib/neon'
import { Button, Card } from '../components'

function initiais(name: string, email: string): string {
  const base = name.trim() || email.split('@')[0] || '?'
  return base.slice(0, 2).toUpperCase()
}

export function Perfil() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [fetchLoading, setFetchLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    neonFetch<{ name: string | null }[]>(`/users?id=eq.${user.id}&select=name`, user.jwt)
      .then(rows => { if (rows[0]) setName(rows[0].name ?? '') })
      .catch(() => {})
      .finally(() => setFetchLoading(false))
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const trimmed = name.trim()
    if (!trimmed) { setError('O nome não pode ser vazio.'); return }
    if (trimmed.length > 80) { setError('O nome deve ter no máximo 80 caracteres.'); return }
    setError('')
    setSaving(true)
    try {
      await updateUserName(user.id, trimmed, user.jwt)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar nome.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-surface-card border-b border-border-subtle px-4 py-3 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <h1 className="font-sans font-semibold text-text-primary text-lg">Perfil</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {fetchLoading ? (
          <p className="text-text-secondary font-body text-sm">Carregando...</p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="w-20 h-20 rounded-full bg-surface-elevated flex items-center justify-center font-display text-2xl font-semibold text-equity select-none">
                {initiais(name, user?.email ?? '')}
              </div>
            </div>

            <Card>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-text-secondary font-body text-xs uppercase tracking-widest"
                    htmlFor="profile-name"
                  >
                    Nome de exibição
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Seu nome"
                    value={name}
                    onChange={e => { setName(e.target.value); setSuccess(false); setError('') }}
                    className="h-12 px-4 rounded-xl bg-bg-base border border-border-subtle text-text-primary font-body text-sm placeholder:text-text-tertiary outline-none focus:border-yield transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-text-secondary font-body text-xs uppercase tracking-widest">
                    E-mail
                  </label>
                  <div className="h-12 px-4 rounded-xl bg-bg-base border border-border-subtle text-text-secondary font-body text-sm flex items-center select-all">
                    {user?.email ?? ''}
                  </div>
                  <p className="text-text-tertiary font-body text-xs">O e-mail não pode ser alterado.</p>
                </div>

                {success && (
                  <p className="text-equity font-body text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Nome atualizado com sucesso.
                  </p>
                )}
                {error && <p className="text-alert font-body text-sm">{error}</p>}

                <Button type="submit" variant="primary" disabled={saving} className="w-full">
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </form>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
