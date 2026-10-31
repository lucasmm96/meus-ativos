# DESIGN SYSTEM & TOKENS

## Cores (Tailwind config)
- `bg-background`: #121212 (Dark Mode base)
- `bg-surface`: #1E1E1E (Cards)
- `text-primary`: #FFFFFF
- `text-secondary`: #A0A0A0
- `acao-green`: #6CBA3B (Gráficos de Ação)
- `fii-blue`: #4285F4 (Gráficos de FII)
- `error`: #CF6679

## Tipografia
- Títulos de Gráficos: Fonte Serifada (ex: `font-serif` ou `Playfair Display`), uppercase, branco.
- Textos de UI: `Inter` ou `Roboto` (sans-serif).

## Componentes Obrigatórios
- `OfflineBanner`: Barra fixa no topo, fundo `bg-error`, texto branco: "Você está offline. Conecte-se para visualizar os dados."
- `ChartCard`: Container com `bg-surface`, padding, borda arredondada (`rounded-lg`).