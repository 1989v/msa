import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// frontend-design.md §8 — 빈 상태 = 온보딩 기회
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-2xl border border-dashed border-ink-200 px-5 py-8',
        className,
      )}
    >
      {icon && <div className="text-ink-400">{icon}</div>}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
        {description && <p className="text-base text-ink-600">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
