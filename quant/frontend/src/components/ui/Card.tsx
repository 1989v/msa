import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// frontend-design.md §1 — Cardocalypse(중첩 카드) 회피용 단순 카드 1종.
// side-stripe / glassmorphism / 보라 그래디언트 등 금지 패턴 없음.
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white border border-ink-100 px-4 py-4',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between gap-3', className)} {...rest} />
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-ink-900', className)} {...rest} />
}
