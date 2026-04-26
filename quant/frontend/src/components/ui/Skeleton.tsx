import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// frontend-design.md §6 — 스피너보다 스켈레톤 우선
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse bg-ink-100 rounded-md', className)}
      aria-busy="true"
      {...rest}
    />
  )
}
