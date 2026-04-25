import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import type { StrategyStatus } from '@/types/api'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'brand' | 'up' | 'down'
}

const toneClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700',
  up: 'bg-pnl-up/10 text-pnl-up',
  down: 'bg-pnl-down/10 text-pnl-down',
}

export function Badge({ className, tone = 'neutral', ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
        toneClass[tone],
        className,
      )}
      {...rest}
    />
  )
}

const statusToneMap: Record<StrategyStatus, BadgeProps['tone']> = {
  DRAFT: 'neutral',
  ACTIVE: 'up',
  PAUSED: 'brand',
  LIQUIDATED: 'neutral',
  ARCHIVED: 'neutral',
}

const statusLabel: Record<StrategyStatus, string> = {
  DRAFT: '초안',
  ACTIVE: '운용중',
  PAUSED: '일시정지',
  LIQUIDATED: '청산',
  ARCHIVED: '보관',
}

export function StatusBadge({ status }: { status: StrategyStatus }) {
  return <Badge tone={statusToneMap[status]}>{statusLabel[status]}</Badge>
}
