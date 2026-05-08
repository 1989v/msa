// charting/components/MicrocontextRail.tsx
//
// Toss-style 가로 스크롤 microcontext chips. 종목 헤더 아래 행에 배치.
// 데스크톱: 좌·우 chevron 버튼 (스크롤 가능 시에만 노출)
// 모바일: scrollbar-hide + scroll-snap-x
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface MicrocontextChip {
  key: string
  label: string
  value: ReactNode
  /** Optional secondary line (예: 30일 범위의 high). */
  secondary?: ReactNode
  /** Optional tone — colors the primary value. */
  tone?: 'rise' | 'fall' | 'neutral' | 'muted'
  /** Optional click handler — chip 이 interactive 면 button 으로 렌더. */
  onClick?: () => void
  /** Optional inline visual (mini bar, sparkline 등). */
  visual?: ReactNode
}

interface Props {
  chips: MicrocontextChip[]
  className?: string
}

export function MicrocontextRail({ chips, className }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setCanLeft(el.scrollLeft > 4)
      setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [chips.length])

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({
      left: dir * Math.max(280, el.clientWidth * 0.6),
      behavior: 'smooth',
    })
  }

  if (chips.length === 0) return null

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-label="왼쪽으로 스크롤"
        onClick={() => scrollBy(-1)}
        className={cn(
          'hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 items-center justify-center rounded-full transition-opacity',
          canLeft ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{
          background: 'color-mix(in oklch, var(--ko-surface-1) 92%, transparent)',
          border: '1px solid var(--ko-border-subtle)',
          color: 'var(--ko-text-secondary)',
        }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={scrollRef}
        role="list"
        className="flex gap-2 overflow-x-auto scrollbar-hide snap-x"
        style={{ scrollPaddingLeft: '12px', scrollPaddingRight: '12px' }}
      >
        {chips.map(chip => (
          <ChipView key={chip.key} chip={chip} />
        ))}
      </div>

      <button
        type="button"
        aria-label="오른쪽으로 스크롤"
        onClick={() => scrollBy(1)}
        className={cn(
          'hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 items-center justify-center rounded-full transition-opacity',
          canRight ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{
          background: 'color-mix(in oklch, var(--ko-surface-1) 92%, transparent)',
          border: '1px solid var(--ko-border-subtle)',
          color: 'var(--ko-text-secondary)',
        }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function ChipView({ chip }: { chip: MicrocontextChip }) {
  const interactive = !!chip.onClick
  const sharedProps = {
    role: 'listitem',
    className: cn(
      'shrink-0 snap-start min-w-[120px] px-3 py-2 rounded-lg text-left transition-colors',
      interactive && 'hover:brightness-110 active:scale-[0.98]',
    ),
    style: {
      background: 'var(--ko-surface-1)',
      border: '1px solid var(--ko-border-subtle)',
    } as const,
  }

  const inner = (
    <>
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        {chip.label}
      </div>
      <div
        className="mt-0.5 text-sm font-semibold tabular-nums leading-tight"
        style={{ color: toneColor(chip.tone) }}
      >
        {chip.value}
      </div>
      {chip.secondary != null && (
        <div
          className="text-[11px] mt-0.5 tabular-nums leading-tight"
          style={{ color: 'var(--ko-text-muted)' }}
        >
          {chip.secondary}
        </div>
      )}
      {chip.visual && <div className="mt-1.5">{chip.visual}</div>}
    </>
  )

  return interactive ? (
    <button type="button" onClick={chip.onClick} {...sharedProps}>
      {inner}
    </button>
  ) : (
    <div {...sharedProps}>{inner}</div>
  )
}

function toneColor(tone?: MicrocontextChip['tone']): string {
  switch (tone) {
    case 'rise':
      return 'var(--ko-quote-rise)'
    case 'fall':
      return 'var(--ko-quote-fall)'
    case 'muted':
      return 'var(--ko-text-muted)'
    case 'neutral':
    default:
      return 'var(--ko-text-primary)'
  }
}

/**
 * 30일 high-low 범위 안에서 현재가 위치를 시각화하는 작은 바.
 * 별도 chip 의 `visual` prop 로 사용.
 */
export function RangePositionBar({ position }: { position: number }) {
  const pct = Math.max(0, Math.min(1, position)) * 100
  return (
    <div
      className="relative w-full h-1 rounded-full"
      style={{ background: 'var(--ko-surface-3)' }}
    >
      <div
        className="absolute top-0 bottom-0 w-1 rounded-full"
        style={{
          left: `calc(${pct}% - 2px)`,
          background: 'var(--ko-text-primary)',
        }}
      />
    </div>
  )
}
