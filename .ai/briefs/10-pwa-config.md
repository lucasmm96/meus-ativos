# CONFIGURAÇÃO PWA E OFFLINE

- **`vite.config.ts`:** Usar `vite-plugin-pwa` com `registerType: 'autoUpdate'`.
- O `manifest` deve apontar para os ícones da pasta `public/`:
  ```typescript
  manifest: {
    name: 'Meus Ativos',
    short_name: 'Meus Ativos',
    theme_color: '#131313',
    background_color: '#131313',
    display: 'standalone',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  }