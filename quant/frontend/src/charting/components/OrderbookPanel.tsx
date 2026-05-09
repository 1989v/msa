// charting/components/OrderbookPanel.tsx — ADR-0039 호가 패널 (CRYPTO 빗썸).
//
// 매도 (asks, 위) + 매수 (bids, 아래) 5/10단 시각화. depth bar.
// 빗썸 ws 실 구독 wire-up 은 후속 PR — 현재는 백엔드 InMemoryOrderbookStore 가 빈 snapshot 반환.
import type { OrderbookSnapshot, TradeFill } from '@/charting/hooks/useOrderbook'

interface Props {
  snapshot: OrderbookSnapshot | null
  trades: TradeFill[]
  isCrypto: boolean
  loading?: boolean
}

export function OrderbookPanel({ snapshot, trades, isCrypto, loading }: Props) {
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
  if (loading) {
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
          빗썸 WebSocket subscriber wire-up 은 후속 PR — InMemoryOrderbookStore
          에 publish 가 들어오면 자동 동작합니다.
        </p>
      </div>
    )
  }

  const asks = [...snapshot.asks].slice(0, 10).reverse() // 위에서 아래로 (price 내림차순)
  const bids = [...snapshot.bids].slice(0, 10)

  const maxQty = Math.max(
    ...asks.map(a => parseFloat(a.quantity)),
    ...bids.map(b => parseFloat(b.quantity)),
    0.0001,
  )

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        {asks.map((l, i) => (
          <Row key={`ask-${i}`} level={l} side="ask" maxQty={maxQty} />
        ))}
        <div
          className="border-t my-1"
          style={{ borderColor: 'var(--ko-border-subtle)' }}
        />
        {bids.map((l, i) => (
          <Row key={`bid-${i}`} level={l} side="bid" maxQty={maxQty} />
        ))}
      </div>

      {trades.length > 0 && (
        <div>
          <div
            className="text-[10px] uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            최근 체결
          </div>
          <ul className="space-y-0.5">
            {trades.slice(0, 10).map((t, i) => (
              <li
                key={i}
                className="flex justify-between text-xs tabular-nums"
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
                <span style={{ color: 'var(--ko-text-secondary)' }}>
                  {parseFloat(t.quantity).toFixed(4)}
                </span>
                <span
                  className="text-[10px]"
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
}

function Row({
  level,
  side,
  maxQty,
}: {
  level: { price: string; quantity: string }
  side: 'ask' | 'bid'
  maxQty: number
}) {
  const qty = parseFloat(level.quantity)
  const pct = Math.min(100, (qty / maxQty) * 100)
  const color =
    side === 'ask' ? 'var(--ko-quote-fall)' : 'var(--ko-quote-rise)'
  const bar =
    side === 'ask'
      ? `linear-gradient(to left, color-mix(in oklch, var(--ko-quote-fall) 18%, transparent) ${pct}%, transparent 0)`
      : `linear-gradient(to left, color-mix(in oklch, var(--ko-quote-rise) 18%, transparent) ${pct}%, transparent 0)`
  return (
    <div
      className="flex justify-between text-xs tabular-nums px-1.5 py-1 rounded"
      style={{ background: bar }}
    >
      <span style={{ color }}>{parseFloat(level.price).toLocaleString()}</span>
      <span style={{ color: 'var(--ko-text-secondary)' }}>
        {qty.toFixed(4)}
      </span>
    </div>
  )
}
