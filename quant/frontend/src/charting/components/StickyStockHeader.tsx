// charting/components/StickyStockHeader.tsx
//
// Toss-style sticky 종목 헤더. 종목명+코드+자산라벨 + 큰 가격 + 변동률.
// 헤더 아래 microcontext rail 은 children prop 으로 호출자 직접 렌더.
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { Symbol as ChartSymbol } from '@/charting/api'
import { PriceFlash } from './PriceFlash'

export interface StickyHeaderPriceSummary {
  last: number
  change: number
  changePct: number
  isUp: boolean
}

interface Props {
  symbol: ChartSymbol
  priceSummary: StickyHeaderPriceSummary | null
  /** 호출자 측 통화 포맷 (예: ₩276,500). */
  formatPrice: (n: number) => string
  onSymbolClick?: () => void
  /** 헤더 하단 microcontext rail. 호출자가 MicrocontextRail 직접 렌더. */
  microcontext?: ReactNode
  className?: string
}

export function StickyStockHeader({
  symbol,
  priceSummary,
  formatPrice,
  onSymbolClick,
  microcontext,
  className,
}: Props) {
  const tone: 'rise' | 'fall' | undefined = priceSummary
    ? priceSummary.isUp
      ? 'rise'
      : 'fall'
    : undefined

  return (
    <header
      className={cn('sticky top-0 z-20 backdrop-blur-md', className)}
      style={{
        background:
          'color-mix(in oklch, var(--ko-surface-0) 88%, transparent)',
        borderBottom: '1px solid var(--ko-border-subtle)',
      }}
    >
      <div className="px-4 md:px-6 pt-3 pb-2 flex items-end gap-3">
        <button
          type="button"
          onClick={onSymbolClick}
          className="flex items-center gap-1.5 group active:scale-[0.98] transition-transform"
        >
          <div className="text-left">
            <div
              className="text-base md:text-lg font-bold leading-tight"
              style={{ color: 'var(--ko-text-primary)' }}
            >
              {symbol.name}
            </div>
            <div
              className="text-[11px] md:text-xs leading-tight"
              style={{ color: 'var(--ko-text-muted)' }}
            >
              {symbol.ticker} · {assetLabel(symbol.assetClass)}
            </div>
          </div>
          <ChevronDown
            className="w-4 h-4 group-hover:translate-y-0.5 transition-transform"
            style={{ color: 'var(--ko-text-muted)' }}
            aria-hidden="true"
          />
        </button>

        <div className="flex-1" />

        {priceSummary && (
          <div className="text-right">
            <PriceFlash price={priceSummary.last}>
              <div
                className="text-xl md:text-2xl font-bold tabular-nums leading-tight"
                style={{ color: toneToVar(tone) }}
              >
                {formatPrice(priceSummary.last)}
              </div>
            </PriceFlash>
            <div
              className="text-xs md:text-sm tabular-nums leading-tight mt-0.5"
              style={{ color: toneToVar(tone) }}
            >
              {priceSummary.isUp ? '▲' : '▼'}{' '}
              {Math.abs(priceSummary.changePct).toFixed(2)}%
              <span
                className="ml-1.5"
                style={{ color: 'var(--ko-text-muted)' }}
              >
                ({priceSummary.change >= 0 ? '+' : ''}
                {formatPrice(priceSummary.change)})
              </span>
            </div>
          </div>
        )}
      </div>

      {microcontext && (
        <div className="px-4 md:px-6 pb-2.5">{microcontext}</div>
      )}
    </header>
  )
}

function assetLabel(a: ChartSymbol['assetClass']): string {
  return a === 'CRYPTO' ? '코인' : a === 'STOCK_KR' ? '국내주식' : '미국주식'
}

function toneToVar(tone?: 'rise' | 'fall'): string {
  if (tone === 'rise') return 'var(--ko-quote-rise)'
  if (tone === 'fall') return 'var(--ko-quote-fall)'
  return 'var(--ko-text-primary)'
}
