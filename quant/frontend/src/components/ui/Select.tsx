import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...rest }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border bg-white px-3 text-base text-ink-900',
          'transition-colors duration-150',
          'focus:outline-none',
          invalid
            ? 'border-pnl-down'
            : 'border-ink-200 hover:border-ink-300 focus:border-brand-500',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'
