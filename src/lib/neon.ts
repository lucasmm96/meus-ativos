// PostgREST client for Neon Data API
// Set VITE_NEON_API_URL to your Neon project's Data API endpoint
const BASE = import.meta.env.VITE_NEON_API_URL ?? ''

export async function neonFetch<T>(path: string, jwt: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Neon API error ${res.status}`)
  return res.json() as Promise<T>
}

export async function neonMutate(path: string, jwt: string, body: unknown, method = 'POST'): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Neon API error ${res.status}`)
}
