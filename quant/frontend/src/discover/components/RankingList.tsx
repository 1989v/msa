// discover/components/RankingList.tsx
import type { MarketRanking } from '@/api/discover'
import { Link } from 'react-router-dom'

interface Props {
  rankings: MarketRanking[]
  /** 컨텍스트 — turnover/gainers/losers 에 따라 표시할 보조 컬럼이 달라짐. */
  emphasize?: 'turnover' | 'change' | 'volume'
  loading?: boolean
}

export function RankingList({ rankings, emphasize = 'turnover', loading }: Props) {
  if (loading) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: 'var(--ko-text-muted)' }}>
        랭킹 불러오는 중…
      </p>
    )
  }
  if (rankings.length === 0) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: 'var(--ko-text-muted)' }}>
        랭킹 데이터가 없습니다 (자산 카탈로그 비어있거나 OHLCV 미적재).
      </p>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--ko-border-subtle)' }}>
      {rankings.map((r, idx) => (
        <RankingRow key={`${r.asset}:${r.market}`} rank={idx + 1} item={r} emphasize={emphasize} />
      ))}
    </div>
  )
}

function RankingRow({
  rank,
  item,
  emphasize,
}: {
  rank: number
  item: MarketRanking
  emphasize: 'turnover' | 'change' | 'volume'
}) {
  const changePct = item.changePct ? parseFloat(item.changePct) * 100 : null
  const isUp = changePct != null && changePct >= 0
  const tone = changePct == null ? 'muted' : isUp ? 'rise' : 'fall'

  // /charts?asset=...&market=... 진입 (ChartsPage 가 query 받지 않으니 그냥 link 만)
  const href = '/charts'

  return (
    <Link
      to={href}
      className="flex items-center justify-between gap-3 py-3 px-2 transition-colors hover:brightness-110"
      style={{ background: 'transparent' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-xs tabular-nums w-6 text-center"
          style={{ color: 'var(--ko-text-muted)' }}
        >
          {rank}
        </span>
        <div className="min-w-0">
          <div
            className="text-sm font-medium truncate"
            style={{ color: 'var(--ko-text-primary)' }}
          >
            {item.displayName}
          </div>
          <div
            className="text-[11px] truncate"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            {item.asset} · {assetClassLabel(item.assetClass)}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className="text-sm font-semibold tabular-nums"
          style={{ color: 'var(--ko-text-primary)' }}
        >
          {formatPriceCompact(item.lastClose, item.assetClass)}
        </div>
        <div
          className="text-[11px] tabular-nums"
          style={{ color: toneColor(tone) }}
        >
          {emphasize === 'change'
            ? formatPctSigned(changePct)
            : emphasize === 'volume'
              ? formatCompact(item.volume)
              : formatCompactKrw(item.turnover, item.assetClass)}
        </div>
      </div>
    </Link>
  )
}

function assetClassLabel(c: string): string {
  if (c === 'CRYPTO') return '코인'
  if (c === 'STOCK_KR') return '국내주식'
  if (c === 'STOCK_US') return '미국주식'
  return c
}

function toneColor(t: 'rise' | 'fall' | 'muted'): string {
  if (t === 'rise') return 'var(--ko-quote-rise)'
  if (t === 'fall') return 'var(--ko-quote-fall)'
  return 'var(--ko-text-muted)'
}

function formatPriceCompact(s: string, assetClass: string): string {
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return '—'
  if (assetClass === 'STOCK_US') {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

function formatPctSigned(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '—'
  return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`
}

function formatCompactKrw(s: string, assetClass: string): string {
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (assetClass === 'STOCK_US') {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조원`
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}만원`
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function formatCompact(s: string): string {
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString()
}
