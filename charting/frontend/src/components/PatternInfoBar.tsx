// charting/frontend/src/components/PatternInfoBar.tsx
import type { PatternMatch } from '../lib/patternMatcher'
import type { Signal } from '../lib/patterns'

interface Props {
  matches: PatternMatch[]
}

const SIGNAL_COLOR: Record<Signal, string> = {
  bullish: '#15803d', bearish: '#b91c1c', neutral: '#a16207',
}

export function PatternInfoBar({ matches }: Props) {
  if (matches.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 16px' }}>
      {matches.map(({ pattern, score, correlation }) => (
        <div key={pattern.id} style={{
          background: '#f8fafc', border: `1px solid #e2e8f0`, borderRadius: 8,
          padding: '14px 18px', borderLeft: `4px solid ${pattern.color}`,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: pattern.color }}>{pattern.name}</span>
            <span style={{ fontSize: 11, color: SIGNAL_COLOR[pattern.signal], fontWeight: 600 }}>
              {pattern.signal === 'bullish' ? '▲ 상승' : pattern.signal === 'bearish' ? '▼ 하락' : '→ 중립'}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
              r = {correlation.toFixed(3)} · 매칭 <strong style={{ color: '#1e293b' }}>{score}%</strong>
            </span>
          </div>

          {/* Score bar */}
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${score}%`, background: pattern.color, borderRadius: 2 }} />
          </div>

          {/* Description */}
          <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, margin: '0 0 8px' }}>{pattern.description}</p>

          {/* Key points */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {pattern.keyPoints.map((pt, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 7px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, color: '#475569' }}>
                {pt}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
