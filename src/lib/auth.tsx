import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { authClient } from './auth-client'

interface AuthUser { id: string; email: string; jwt: string }
interface AuthCtx {
  user: AuthUser | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

async function upsertUser(id: string, email: string, jwt: string) {
  const base = import.meta.env.VITE_NEON_DATA_API_URL ?? ''
  if (!base) return
  try {
    await fetch(`${base}/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({ id, email }),
    })
  } catch {
    // non-fatal: user record may already exist
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.session && data?.user) {
        setUser({ id: data.user.id, email: data.user.email ?? '', jwt: data.session.token })
      }
    })
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({ email, password })
    if (error) throw new Error(error.message ?? 'Falha no login')
    if (!data) throw new Error('Falha no login')
    const authUser: AuthUser = { id: data.user.id, email: data.user.email ?? '', jwt: data.session.token }
    await upsertUser(authUser.id, authUser.email, authUser.jwt)
    setUser(authUser)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signUp.email({ email, password, name: email })
    if (error) throw new Error(error.message ?? 'Falha no cadastro')
    if (!data) throw new Error('Falha no cadastro')
    const authUser: AuthUser = { id: data.user.id, email: data.user.email ?? '', jwt: data.session.token }
    await upsertUser(authUser.id, authUser.email, authUser.jwt)
    setUser(authUser)
  }, [])

  const signOut = useCallback(async () => {
    await authClient.signOut()
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, signIn, signUp, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
