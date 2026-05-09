// discover/components/IndicesMarquee.tsx
//
// 글로벌 지수 마퀴 — ADR-0042 D4 8종 무한 반복 가로 스크롤.
// CSS keyframe animation (prefers-reduced-motion: reduce 시 정적).
import type { GlobalIndexQuote } from '@/api/discover'

interface Props {
  indices: GlobalIndexQuote[]
}

export function IndicesMarquee({ indices }: Props) {
  if (indices.length === 0) return null
  // 무한 반복: 두 번 렌더해서 100% 슬라이드 시 자연스러운 loop.
  const dup = [...indices, ...indices]
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background:
          'color-mix(in oklch, var(--ko-surface-1) 60%, transparent)',
        borderTop: '1px solid var(--ko-border-subtle)',
        borderBottom: '1px solid var(--ko-border-subtle)',
      }}
      aria-label="글로벌 지수 시세"
    >
      <div className="ko-indices-marquee-track flex gap-6 py-2 px-4 whitespace-nowrap">
        {dup.map((idx, i) => (
          <IndexChip key={`${idx.ticker}-${i}`} q={idx} />
        ))}
      </div>
      <style>{`
        .ko-indices-marquee-track {
          animation: ko-indices-marquee 60s linear infinite;
          width: max-content;
        }
        @keyframes ko-indices-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ko-indices-marquee-track { animation: none; }
        }
      `}</style>
    </div>
  )
}

function IndexChip({ q }: { q: GlobalIndexQuote }) {
  const change = q.changePct ? parseFloat(q.changePct) * 100 : null
  const isUp = change != null && change >= 0
  const tone = change == null ? 'muted' : isUp ? 'rise' : 'fall'
  const price = parseFloat(q.price)
  return (
    <span className="inline-flex items-baseline gap-1.5 shrink-0">
      <span
        className="text-[11px]"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        {q.displayName}
      </span>
      <span
        className="text-xs font-semibold tabular-nums"
        style={{ color: 'var(--ko-text-primary)' }}
      >
        {Number.isFinite(price)
          ? price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—'}
      </span>
      <span
        className="text-[11px] tabular-nums"
        style={{
          color:
            tone === 'rise'
              ? 'var(--ko-quote-rise)'
              : tone === 'fall'
                ? 'var(--ko-quote-fall)'
                : 'var(--ko-text-muted)',
        }}
      >
        {change != null
          ? `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`
          : '—'}
      </span>
    </span>
  )
}
