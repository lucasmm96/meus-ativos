import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 px-4 py-2
        bg-alert/10 border-b border-alert text-alert font-body text-xs font-medium tracking-wide"
    >
      <span className="material-symbols-outlined text-base">wifi_off</span>
      Você está offline. Conecte-se para visualizar os dados.
    </div>
  )
}
