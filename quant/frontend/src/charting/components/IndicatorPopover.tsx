// charting/components/IndicatorPopover.tsx
//
// 도구바의 "보조지표" 팝오버 — 기존 IndicatorToggle 을 wrap.
// 클릭 시 dropdown 으로 펼침. 외부 클릭/ESC 로 닫힘.
// Portal 로 document.body 에 렌더 — overflow-x-auto 부모 (ChartToolbar) 의 clipping 회피.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // 버튼 위치 변경 시 panel 위치 재계산 (window resize / scroll).
  useEffect(() => {
    if (!open || !buttonRef.current) return
    const compute = () => {
      const r = buttonRef.current!.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open])

  // 외부 클릭/ESC 로 닫힘. panelRef 포함 — portal 로 빼서 rootRef 자식이 아니므로 별도 체크.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      const inRoot = rootRef.current?.contains(t) ?? false
      const inPanel = panelRef.current?.contains(t) ?? false
      if (!inRoot && !inPanel) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const activeCount = countActive(value)

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
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

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="보조지표 설정"
          className="w-[320px] max-h-[70vh] overflow-y-auto rounded-xl shadow-2xl p-3"
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            background: '#0c1424',
            border: '1px solid #475569',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          }}
        >
          <IndicatorToggle
            value={value}
            onChange={onChange}
            params={params}
            onParamsChange={onParamsChange}
          />
        </div>,
        document.body,
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
