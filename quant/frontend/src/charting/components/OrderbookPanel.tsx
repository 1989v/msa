// charting/components/OrderbookPanel.tsx — ADR-0039 호가 패널 (CRYPTO 빗썸).
//
// 토스 증권 order 페이지 (https://www.tossinvest.com/stocks/A005490/order) 레퍼런스
// 의 price ladder 디자인:
//   ┌─────────┬─────────┬─────────┐
//   │ 매도잔량 │  가격   │ 매수잔량 │
//   ├─────────┼─────────┼─────────┤
//   │ ████ 50 │ 80,500  │         │  ← 매도호가 (price 내림차순)
//   │ ██  25  │ 80,400  │         │
//   │ ─────── 80,300 ── 현재가 ──│
//   │         │ 80,200  │ ███ 35  │  ← 매수호가 (price 내림차순)
//   │         │ 80,100  │ █████ 80│
//   └─────────┴─────────┴─────────┘
//
// 가격 클릭 시 onPriceClick 콜백 (주문창 통합 시 prefill 용 — 현재는 prop 만 노출).
import { Fragment, memo } from 'react'
import type { OrderbookSnapshot, TradeFill } from '@/charting/hooks/useOrderbook'

interface Props {
  snapshot: OrderbookSnapshot | null
  trades: TradeFill[]
  isCrypto: boolean
  loading?: boolean
  /** 현재가 — 매도/매수 가운데 highlight row. */
  currentPrice?: number | null
  /** 가격 클릭 — 주문창 prefill 콜백 (선택). */
  onPriceClick?: (price: number) => void
  /** 호가 단계 수 (default 10). */
  depth?: number
}

export const OrderbookPanel = memo(function OrderbookPanel({
  snapshot,
  trades,
  isCrypto,
  loading,
  currentPrice,
  onPriceClick,
  depth = 10,
}: Props) {
  if (!isCrypto) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        호가/체결은 CRYPTO (빗썸) 전용입니다.
      </p>
    )
  }
  if (loading && !snapshot) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        호가 데이터 불러오는 중…
      </p>
    )
  }
  if (!snapshot || (snapshot.asks.length === 0 && snapshot.bids.length === 0)) {
    return (
      <div className="py-6 text-center space-y-2">
        <p className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
          호가 snapshot 없음
        </p>
        <p
          className="text-[11px] max-w-md mx-auto"
          style={{ color: 'var(--ko-text-muted)' }}
        >
          빗썸 WebSocket subscriber 가 연결되면 자동 표시됩니다.
        </p>
      </div>
    )
  }

  // 매도호가 — price 오름차순으로 받아서 위에서 아래로 내림차순 표시 (역순)
  const asks = [...snapshot.asks].slice(0, depth).reverse()
  const bids = [...snapshot.bids].slice(0, depth)

  const askTotal = asks.reduce((acc, a) => acc + parseFloat(a.quantity), 0)
  const bidTotal = bids.reduce((acc, b) => acc + parseFloat(b.quantity), 0)
  const grandTotal = askTotal + bidTotal
  const askPct = grandTotal > 0 ? (askTotal / grandTotal) * 100 : 50
  const bidPct = grandTotal > 0 ? (bidTotal / grandTotal) * 100 : 50

  const maxQty = Math.max(
    ...asks.map(a => parseFloat(a.quantity)),
    ...bids.map(b => parseFloat(b.quantity)),
    0.0001,
  )

  return (
    <div className="space-y-3">
      {/* 호가 그리드 */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--ko-surface-1)' }}
      >
        {/* 헤더 */}
        <div
          className="grid grid-cols-3 text-[10px] uppercase tracking-wider px-2 py-1.5"
          style={{
            color: 'var(--ko-text-muted)',
            borderBottom: '1px solid var(--ko-border-subtle)',
          }}
        >
          <div className="text-right pr-2">매도잔량</div>
          <div className="text-center">가격</div>
          <div className="text-left pl-2">매수잔량</div>
        </div>

        {/* 매도호가 (위, price 내림차순) */}
        {asks.map((ask, i) => (
          <LadderRow
            key={`ask-${i}`}
            side="ask"
            price={parseFloat(ask.price)}
            qty={parseFloat(ask.quantity)}
            maxQty={maxQty}
            onPriceClick={onPriceClick}
          />
        ))}

        {/* 현재가 라인 */}
        {currentPrice != null && Number.isFinite(currentPrice) && (
          <div
            className="px-2 py-1.5 text-center text-sm font-bold tabular-nums"
            style={{
              background:
                'color-mix(in oklch, var(--ko-accent-primary) 14%, transparent)',
              borderTop: '1px solid var(--ko-accent-primary)',
              borderBottom: '1px solid var(--ko-accent-primary)',
              color: 'var(--ko-accent-primary)',
            }}
          >
            현재가 {currentPrice.toLocaleString()}
          </div>
        )}

        {/* 매수호가 (아래, price 내림차순) */}
        {bids.map((bid, i) => (
          <LadderRow
            key={`bid-${i}`}
            side="bid"
            price={parseFloat(bid.price)}
            qty={parseFloat(bid.quantity)}
            maxQty={maxQty}
            onPriceClick={onPriceClick}
          />
        ))}

        {/* 합계 */}
        <div
          className="grid grid-cols-3 text-[11px] tabular-nums px-2 py-1.5"
          style={{
            color: 'var(--ko-text-muted)',
            borderTop: '1px solid var(--ko-border-subtle)',
          }}
        >
          <div className="text-right pr-2">
            <span style={{ color: 'var(--ko-quote-fall)' }}>
              {askTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
            <span className="ml-1 text-[10px]">{askPct.toFixed(0)}%</span>
          </div>
          <div className="text-center">총잔량</div>
          <div className="text-left pl-2">
            <span style={{ color: 'var(--ko-quote-rise)' }}>
              {bidTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
            <span className="ml-1 text-[10px]">{bidPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* 매도/매수 비율 bar */}
      <div
        className="flex h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--ko-surface-1)' }}
      >
        <div
          style={{
            width: `${askPct}%`,
            background: 'var(--ko-quote-fall)',
            transition: 'width 200ms ease-out',
          }}
        />
        <div
          style={{
            width: `${bidPct}%`,
            background: 'var(--ko-quote-rise)',
            transition: 'width 200ms ease-out',
          }}
        />
      </div>

      {/* 최근 체결 */}
      {trades.length > 0 && (
        <div>
          <div
            className="text-[10px] uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            최근 체결
          </div>
          <ul className="space-y-0.5">
            {trades.slice(0, 12).map((t, i) => (
              <li
                key={i}
                className="grid grid-cols-3 text-xs tabular-nums px-1.5 py-0.5 rounded"
                style={{
                  background:
                    t.side === 'BUY'
                      ? 'color-mix(in oklch, var(--ko-quote-rise) 8%, transparent)'
                      : 'color-mix(in oklch, var(--ko-quote-fall) 8%, transparent)',
                }}
              >
                <span
                  style={{
                    color:
                      t.side === 'BUY'
                        ? 'var(--ko-quote-rise)'
                        : 'var(--ko-quote-fall)',
                  }}
                >
                  {parseFloat(t.price).toLocaleString()}
                </span>
                <span
                  className="text-center"
                  style={{ color: 'var(--ko-text-secondary)' }}
                >
                  {parseFloat(t.quantity).toFixed(4)}
                </span>
                <span
                  className="text-right text-[10px]"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
                  {t.ts.slice(11, 19)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
})

interface RowProps {
  side: 'ask' | 'bid'
  price: number
  qty: number
  maxQty: number
  onPriceClick?: (price: number) => void
}

function LadderRow({ side, price, qty, maxQty, onPriceClick }: RowProps) {
  const pct = Math.min(100, (qty / maxQty) * 100)
  const isAsk = side === 'ask'
  const color = isAsk ? 'var(--ko-quote-fall)' : 'var(--ko-quote-rise)'
  const bar = isAsk
    ? 'color-mix(in oklch, var(--ko-quote-fall) 22%, transparent)'
    : 'color-mix(in oklch, var(--ko-quote-rise) 22%, transparent)'

  // ask 의 잔량 bar 는 right-aligned (오른쪽에서 왼쪽으로 채움), bid 는 left-aligned
  const askBarStyle = isAsk
    ? {
        position: 'absolute' as const,
        top: 0,
        bottom: 0,
        right: 0,
        width: `${pct}%`,
        background: bar,
      }
    : undefined
  const bidBarStyle = !isAsk
    ? {
        position: 'absolute' as const,
        top: 0,
        bottom: 0,
        left: 0,
        width: `${pct}%`,
        background: bar,
      }
    : undefined

  return (
    <div className="grid grid-cols-3 text-xs tabular-nums">
      {/* 매도잔량 */}
      <div className="relative px-2 py-1 text-right" style={{ overflow: 'hidden' }}>
        {askBarStyle && <div style={askBarStyle} />}
        <span
          className="relative"
          style={{ color: isAsk ? 'var(--ko-text-secondary)' : 'transparent' }}
        >
          {qty.toFixed(4)}
        </span>
      </div>

      {/* 가격 — 클릭 가능 */}
      <button
        type="button"
        onClick={onPriceClick ? () => onPriceClick(price) : undefined}
        className="px-2 py-1 text-center font-medium tabular-nums hover:opacity-80 transition-opacity"
        style={{ color }}
      >
        {price.toLocaleString()}
      </button>

      {/* 매수잔량 */}
      <div className="relative px-2 py-1 text-left" style={{ overflow: 'hidden' }}>
        {bidBarStyle && <div style={bidBarStyle} />}
        <span
          className="relative"
          style={{ color: !isAsk ? 'var(--ko-text-secondary)' : 'transparent' }}
        >
          {qty.toFixed(4)}
        </span>
      </div>
    </div>
  )
}
