import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

// frontend-design.md §6 — 버튼 계층(primary/secondary/ghost), focus-visible 유지, 44px hit-target
const variantClass: Record<Variant, string> = {
  primary:
    'bg-ink-900 text-ink-50 hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300 disabled:text-ink-100',
  secondary:
    'bg-ink-100 text-ink-900 hover:bg-ink-200 active:bg-ink-300 disabled:bg-ink-50 disabled:text-ink-300',
  ghost:
    'bg-transparent text-ink-900 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-300',
  danger:
    'bg-pnl-down text-ink-50 hover:opacity-90 active:opacity-80 disabled:opacity-50',
}

const sizeClass: Record<Size, string> = {
  sm: 'h-10 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-12 px-5 text-base font-semibold',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, className, type = 'button', ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium',
          'transition-colors duration-150 ease-out-expo',
          'disabled:cursor-not-allowed',
          variantClass[variant],
          sizeClass[size],
          fullWidth && 'w-full',
          className,
        )}
        {...rest}
      />
    )
  },
)
Button.displayName = 'Button'
