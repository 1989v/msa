// charting/components/TradeStrengthBar.tsx
//
// 토스 증권 order 페이지의 체결강도 chip 레퍼런스. 최근 N개 체결 중 매수/매도
// 비율을 horizontal bar 로 시각화. 강도 100% = 모두 매수, 0% = 모두 매도.
import { memo, useMemo } from 'react'
import type { TradeFill } from '@/charting/hooks/useOrderbook'

interface Props {
  trades: TradeFill[]
  /** 분석 윈도우 (default 50건). */
  window?: number
}

export const TradeStrengthBar = memo(function TradeStrengthBar({
  trades,
  window = 50,
}: Props) {
  const stats = useMemo(() => {
    const slice = trades.slice(0, window)
    if (slice.length === 0) {
      return { buyQty: 0, sellQty: 0, buyPct: 50, strength: 100 }
    }
    let buyQty = 0
    let sellQty = 0
    for (const t of slice) {
      const q = parseFloat(t.quantity)
      if (!Number.isFinite(q)) continue
      if (t.side === 'BUY') buyQty += q
      else sellQty += q
    }
    const total = buyQty + sellQty
    const buyPct = total > 0 ? (buyQty / total) * 100 : 50
    // 강도 — 매도 잔량 대비 매수 잔량 비율 (토스: 100 기준)
    const strength = sellQty > 0 ? (buyQty / sellQty) * 100 : 999
    return { buyQty, sellQty, buyPct, strength }
  }, [trades, window])

  const tone =
    stats.strength > 120 ? 'rise' : stats.strength < 80 ? 'fall' : 'muted'
  const toneColor =
    tone === 'rise'
      ? 'var(--ko-quote-rise)'
      : tone === 'fall'
        ? 'var(--ko-quote-fall)'
        : 'var(--ko-text-muted)'

  return (
    <div
      className="px-3 py-2 rounded-lg space-y-1.5"
      style={{
        background: 'var(--ko-surface-1)',
        border: '1px solid var(--ko-border-subtle)',
      }}
    >
      <div className="flex justify-between items-center text-[11px]">
        <span style={{ color: 'var(--ko-text-muted)' }}>
          체결강도 (최근 {Math.min(window, trades.length)}건)
        </span>
        <span className="tabular-nums font-bold" style={{ color: toneColor }}>
          {stats.strength >= 999 ? '∞' : stats.strength.toFixed(0)}
        </span>
      </div>
      <div
        className="flex h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--ko-surface-2)' }}
      >
        <div
          style={{
            width: `${stats.buyPct}%`,
            background: 'var(--ko-quote-rise)',
            transition: 'width 250ms ease-out',
          }}
        />
        <div
          style={{
            width: `${100 - stats.buyPct}%`,
            background: 'var(--ko-quote-fall)',
            transition: 'width 250ms ease-out',
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums">
        <span style={{ color: 'var(--ko-quote-rise)' }}>
          매수 {stats.buyQty.toFixed(4)} ({stats.buyPct.toFixed(0)}%)
        </span>
        <span style={{ color: 'var(--ko-quote-fall)' }}>
          ({(100 - stats.buyPct).toFixed(0)}%) {stats.sellQty.toFixed(4)} 매도
        </span>
      </div>
    </div>
  )
})
