import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-surface-card border border-border-subtle rounded-xl p-4 shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
