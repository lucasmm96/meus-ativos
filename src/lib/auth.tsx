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

async function getJwt(): Promise<string> {
  const base = import.meta.env.VITE_NEON_AUTH_URL as string
  const res = await fetch(`${base}/token`, { credentials: 'include' })
  if (!res.ok) throw new Error(`JWT exchange: ${res.status}`)
  const { token } = (await res.json()) as { token?: string }
  if (!token) throw new Error('Servidor não retornou JWT')
  return token
}

async function upsertUser(id: string, email: string, jwt: string) {
  const base = import.meta.env.VITE_NEON_DATA_API_URL ?? ''
  if (!base) return
  const res = await fetch(`${base}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify({ id, email }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`upsertUser ${res.status}: ${body}`)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    authClient.getSession().then(async ({ data }) => {
      if (data?.session && data?.user) {
        try {
          const jwt = await getJwt()
          try {
            await upsertUser(data.user.id, data.user.email ?? '', jwt)
          } catch (e) {
            console.error('upsertUser on session restore:', e)
          }
          setUser({ id: data.user.id, email: data.user.email ?? '', jwt })
        } catch {
          // JWT exchange failed — user must re-login
        }
      }
    })
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({ email, password })
    if (error) throw new Error(error.message ?? 'Falha no login')
    if (!data) throw new Error('Falha no login')
    const jwt = await getJwt()
    const authUser: AuthUser = { id: data.user.id, email: data.user.email ?? '', jwt }
    await upsertUser(authUser.id, authUser.email, jwt)
    setUser(authUser)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signUp.email({ email, password, name: email })
    if (error) throw new Error(error.message ?? 'Falha no cadastro')
    if (!data) throw new Error('Falha no cadastro')
    const jwt = await getJwt()
    const authUser: AuthUser = { id: data.user.id, email: data.user.email ?? '', jwt }
    await upsertUser(authUser.id, authUser.email, jwt)
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
