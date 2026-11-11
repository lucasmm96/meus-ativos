import type { ReactNode } from 'react'
import { Card } from './Card'

interface ChartCardProps {
  title: string
  children: ReactNode
  className?: string
}

export function ChartCard({ title, children, className = '' }: ChartCardProps) {
  return (
    <Card className={className}>
      <h3 className="font-sans text-sm font-semibold uppercase tracking-widest text-text-secondary mb-4">
        {title}
      </h3>
      {children}
    </Card>
  )
}
