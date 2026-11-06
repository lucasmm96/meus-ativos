import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'destructive'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base = 'h-12 px-6 rounded-xl font-body font-semibold text-sm tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  const variants: Record<Variant, string> = {
    primary: 'bg-equity text-bg-base hover:opacity-90 focus-visible:ring-equity',
    secondary: 'bg-transparent border border-border-subtle text-text-primary hover:bg-surface-elevated',
    destructive: 'bg-transparent border border-alert text-alert hover:bg-alert/10',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
