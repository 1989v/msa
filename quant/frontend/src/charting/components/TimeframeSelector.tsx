// charting/components/TimeframeSelector.tsx
//
// 7-chip 시간프레임 셀렉터. P1 은 일/주/월/년 활성, 분봉(1m/5m/30m) 은 disabled
// (Phase 3 실시간 SSE + 분봉 ingest 와 함께 활성).
import { TIMEFRAMES, type TimeframeKey } from '../types'
import { cn } from '@/lib/cn'

interface Props {
  value: TimeframeKey
  onChange: (next: TimeframeKey) => void
  className?: string
}

export function TimeframeSelector({ value, onChange, className }: Props) {
  return (
    <div className={cn('flex gap-1', className)} role="tablist" aria-label="시간 범위">
      {TIMEFRAMES.map(tf => {
        const active = tf.key === value
        const disabled = !!tf.disabled
        return (
          <button
            key={tf.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onClick={() => onChange(tf.key)}
            title={disabled ? tf.disabledReason : tf.label}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors',
              disabled && 'cursor-not-allowed',
            )}
            style={{
              background: active
                ? 'color-mix(in oklch, var(--ko-accent-primary) 22%, transparent)'
                : 'color-mix(in oklch, var(--ko-surface-2) 60%, transparent)',
              border: `1px solid ${
                active
                  ? 'color-mix(in oklch, var(--ko-accent-primary) 40%, transparent)'
                  : 'var(--ko-border-subtle)'
              }`,
              color: disabled
                ? 'var(--ko-text-disabled)'
                : active
                  ? 'var(--ko-accent-primary-hover)'
                  : 'var(--ko-text-secondary)',
              opacity: disabled ? 0.55 : 1,
            }}
          >
            {tf.label}
          </button>
        )
      })}
    </div>
  )
}
