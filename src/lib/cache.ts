interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 10 * 60 * 1000,
): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.data as T)
  }
  return fetcher().then((data) => {
    store.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}
