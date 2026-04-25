import { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export function Label({ className, required, children, ...rest }: LabelProps) {
  return (
    <label
      className={cn('block text-sm font-medium text-ink-700 mb-1.5', className)}
      {...rest}
    >
      {children}
      {required && <span className="text-pnl-down ml-0.5" aria-hidden>*</span>}
    </label>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-sm text-pnl-down mt-1.5" role="alert">
      {message}
    </p>
  )
}

export function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-500 mt-1.5">{children}</p>
}
