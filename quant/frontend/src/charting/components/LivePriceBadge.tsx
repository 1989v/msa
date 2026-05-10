// charting/components/LivePriceBadge.tsx
//
// 실시간 가격 표시 격리 컴포넌트 — SSE tick 으로 인한 re-render 가 부모 (ChartsPage)
// 까지 전파되지 않도록 자체 캡슐화.
//
// - 자체 usePriceStream 구독 → tick 마다 자체 state update 만 발생
// - DOM mutation 은 가격/변동률 텍스트 노드만 (transition 비활성)
// - 부모는 baseLast / baseFirst (정적) 만 prop 으로 전달
import { memo } from 'react'
import { usePriceStream } from '@/charting/hooks/usePriceStream'

interface Props {
  /** SSE 구독 자산 코드 (예: 'BTC-USD'). null/undefined 면 stream off. */
  asset: string | null | undefined
  /** SSE 구독 시장 코드. */
  market: string | null | undefined
  /** ohlcv 마지막 close — tick 미수신 시 fallback. */
  baseLast: number
  /** ohlcv 첫 close — 변동률 기준점. */
  baseFirst: number
  /** 가격 포맷터 (자산 클래스별 통화 분기). */
  format: (n: number) => string
  /** 큰 가격 텍스트 className. */
  priceClassName?: string
  /** 변동률 텍스트 className. */
  changeClassName?: string
}

function toneVar(tone: 'rise' | 'fall' | 'muted'): string {
  if (tone === 'rise') return 'var(--ko-quote-rise)'
  if (tone === 'fall') return 'var(--ko-quote-fall)'
  return 'var(--ko-text-muted)'
}

export const LivePriceBadge = memo(function LivePriceBadge({
  asset,
  market,
  baseLast,
  baseFirst,
  format,
  priceClassName,
  changeClassName,
}: Props) {
  const stream = usePriceStream(asset, market)
  const liveLast = stream.tick ? parseFloat(stream.tick.price) : NaN
  const last = Number.isFinite(liveLast) ? liveLast : baseLast
  const change = last - baseFirst
  const changePct = baseFirst > 0 ? (change / baseFirst) * 100 : 0
  const isUp = change >= 0
  const tone: 'rise' | 'fall' | 'muted' =
    change > 0 ? 'rise' : change < 0 ? 'fall' : 'muted'

  return (
    <div className="text-right">
      <div
        className={
          priceClassName ??
          'text-xl md:text-2xl font-bold tabular-nums leading-tight'
        }
        style={{ color: toneVar(tone) }}
      >
        {format(last)}
      </div>
      <div
        className={
          changeClassName ??
          'text-xs md:text-sm tabular-nums leading-tight mt-0.5'
        }
        style={{ color: toneVar(tone) }}
      >
        {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
        <span className="ml-1.5" style={{ color: 'var(--ko-text-muted)' }}>
          ({change >= 0 ? '+' : ''}
          {format(change)})
        </span>
      </div>
    </div>
  )
})
