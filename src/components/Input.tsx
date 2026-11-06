import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-text-secondary font-body text-xs font-medium tracking-widest uppercase">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`h-12 px-4 rounded-xl bg-bg-base border text-text-primary font-body text-sm placeholder:text-text-tertiary
          focus:outline-none focus:border-yield transition-colors
          ${error ? 'border-alert' : 'border-border-subtle'}
          ${className}`}
        {...props}
      />
      {error && <span className="text-alert text-xs font-body">{error}</span>}
    </div>
  )
}
