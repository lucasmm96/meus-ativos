import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AuthUser { id: string; email: string; jwt: string }
interface AuthCtx {
  user: AuthUser | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('ma_user') ?? 'null') } catch { return null }
  })

  const signIn = useCallback(async (email: string, _password: string) => {
    // TODO: replace with Neon Auth SDK call
    const mock: AuthUser = { id: crypto.randomUUID(), email, jwt: 'mock-jwt' }
    localStorage.setItem('ma_user', JSON.stringify(mock))
    setUser(mock)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    return signIn(email, password)
  }, [signIn])

  const signOut = useCallback(() => {
    localStorage.removeItem('ma_user')
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, signIn, signUp, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
