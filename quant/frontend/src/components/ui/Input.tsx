import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border bg-white px-3 text-base text-ink-900',
          'placeholder:text-ink-400',
          'transition-colors duration-150',
          'focus:outline-none',
          invalid
            ? 'border-pnl-down'
            : 'border-ink-200 hover:border-ink-300 focus:border-brand-500',
          'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
          className,
        )}
        {...rest}
      />
    )
  },
)
Input.displayName = 'Input'
