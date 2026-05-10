// charting/components/QuoteStatRibbon.tsx
//
// 토스 증권 order 페이지 (https://www.tossinvest.com/stocks/A005490/order) 의
// 호가창 상단 stat ribbon 레퍼런스 — 시가/고가/저가/52주H/L/거래량 한눈에 표시.
//
// 데이터 source:
// - 시가/고가/저가/거래량: ohlcv 마지막 봉 (today)
// - 52주 H/L / 평균 거래량: fundamentals (yfinance Ticker.info)
import { memo } from 'react'

interface Props {
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  prevClose: number | null
  weeks52High: number | null
  weeks52Low: number | null
  avgDailyVolume3M: number | null
  formatPrice: (n: number) => string
  formatVolume?: (n: number) => string
  /** KR 주식 (KOSPI/KOSDAQ) — 상하한가 ±30% 표시. */
  isKr?: boolean
}

export const QuoteStatRibbon = memo(function QuoteStatRibbon({
  open,
  high,
  low,
  volume,
  prevClose,
  weeks52High,
  weeks52Low,
  avgDailyVolume3M,
  formatPrice,
  formatVolume,
  isKr = false,
}: Props) {
  const fmtV = formatVolume ?? defaultFormatVolume

  // 변동률 (open 대비 high/low) — 52W 위치 표시용.
  const tone = (v: number | null, ref: number | null): 'rise' | 'fall' | 'muted' => {
    if (v == null || ref == null || !Number.isFinite(v) || !Number.isFinite(ref)) return 'muted'
    if (v > ref) return 'rise'
    if (v < ref) return 'fall'
    return 'muted'
  }

  // KR 상하한가 — 전일 종가 ±30% (KOSPI/KOSDAQ 동일).
  const limitUp = isKr && prevClose != null ? prevClose * 1.3 : null
  const limitDown = isKr && prevClose != null ? prevClose * 0.7 : null

  const items: Array<{ label: string; value: string; tone?: 'rise' | 'fall' | 'muted' }> = [
    { label: '시가', value: open != null ? formatPrice(open) : '—', tone: tone(open, prevClose) },
    { label: '고가', value: high != null ? formatPrice(high) : '—', tone: 'rise' },
    { label: '저가', value: low != null ? formatPrice(low) : '—', tone: 'fall' },
    ...(isKr
      ? [
          { label: '상한가', value: limitUp != null ? formatPrice(limitUp) : '—', tone: 'rise' as const },
          { label: '하한가', value: limitDown != null ? formatPrice(limitDown) : '—', tone: 'fall' as const },
        ]
      : []),
    { label: '52주 최고', value: weeks52High != null ? formatPrice(weeks52High) : '—' },
    { label: '52주 최저', value: weeks52Low != null ? formatPrice(weeks52Low) : '—' },
    { label: '거래량', value: volume != null ? fmtV(volume) : '—' },
    { label: '평균거래량 (3M)', value: avgDailyVolume3M != null ? fmtV(avgDailyVolume3M) : '—' },
  ]

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 px-3 py-2.5 rounded-lg"
      style={{
        background: 'var(--ko-surface-1)',
        border: '1px solid var(--ko-border-subtle)',
      }}
    >
      {items.map(item => (
        <div key={item.label} className="min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            {item.label}
          </div>
          <div
            className="text-sm tabular-nums truncate"
            style={{ color: toneToVar(item.tone) }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
})

function toneToVar(tone?: 'rise' | 'fall' | 'muted'): string {
  if (tone === 'rise') return 'var(--ko-quote-rise)'
  if (tone === 'fall') return 'var(--ko-quote-fall)'
  return 'var(--ko-text-primary)'
}

function defaultFormatVolume(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString()
}
