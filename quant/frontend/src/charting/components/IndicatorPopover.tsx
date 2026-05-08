// charting/components/IndicatorPopover.tsx
//
// 도구바의 "보조지표" 팝오버 — 기존 IndicatorToggle 을 wrap.
// 클릭 시 dropdown 으로 펼침. 외부 클릭/ESC 로 닫힘.
import { useEffect, useRef, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { IndicatorToggle, type Indicators, type IndicatorParams } from './IndicatorToggle'
import { cn } from '@/lib/cn'

interface Props {
  value: Indicators
  onChange: (next: Indicators) => void
  params: IndicatorParams
  onParamsChange: (next: IndicatorParams) => void
  className?: string
}

export function IndicatorPopover({
  value,
  onChange,
  params,
  onParamsChange,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const activeCount = countActive(value)

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
        style={{
          background: open
            ? 'color-mix(in oklch, var(--ko-accent-primary) 22%, transparent)'
            : 'color-mix(in oklch, var(--ko-surface-2) 60%, transparent)',
          border: `1px solid ${
            open
              ? 'color-mix(in oklch, var(--ko-accent-primary) 40%, transparent)'
              : 'var(--ko-border-subtle)'
          }`,
          color: open
            ? 'var(--ko-accent-primary-hover)'
            : 'var(--ko-text-secondary)',
        }}
        title="보조지표"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">지표</span>
        {activeCount > 0 && (
          <span
            className="ml-0.5 px-1 rounded text-[10px] font-semibold tabular-nums"
            style={{
              background:
                'color-mix(in oklch, var(--ko-accent-primary) 30%, transparent)',
              color: 'var(--ko-accent-primary-hover)',
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="보조지표 설정"
          className="absolute right-0 mt-1.5 z-30 w-[320px] max-h-[70vh] overflow-y-auto rounded-xl shadow-lg p-3"
          style={{
            background: 'var(--ko-surface-1)',
            border: '1px solid var(--ko-border-subtle)',
          }}
        >
          <IndicatorToggle
            value={value}
            onChange={onChange}
            params={params}
            onParamsChange={onParamsChange}
          />
        </div>
      )}
    </div>
  )
}

function countActive(s: Indicators): number {
  return (
    Number(s.ma5) +
    Number(s.ma20) +
    Number(s.ma60) +
    Number(s.ma120) +
    Number(s.bb) +
    Number(s.volume) +
    Number(s.rsi) +
    Number(s.macd) +
    Number(s.stochastic) +
    Number(s.williamsR) +
    Number(s.atr) +
    Number(s.obv) +
    Number(s.vwap)
  )
}
