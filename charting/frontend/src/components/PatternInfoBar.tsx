// charting/frontend/src/components/PatternInfoBar.tsx
import type { PatternMatch } from '../lib/patternMatcher'
import type { Signal } from '../lib/patterns'

interface Props {
  match: PatternMatch | null
}

const SIGNAL_COLOR: Record<Signal, string> = {
  bullish: '#15803d', bearish: '#b91c1c', neutral: '#a16207',
}

export function PatternInfoBar({ match }: Props) {
  if (!match) return null
  const { pattern, score, correlation } = match
  const sigColor = SIGNAL_COLOR[pattern.signal]

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', margin: '12px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{pattern.name}</span>
        <span style={{ fontSize: 12, color: sigColor, fontWeight: 600 }}>
          {pattern.signal === 'bullish' ? '▲ 상승 예상' : pattern.signal === 'bearish' ? '▼ 하락 예상' : '→ 중립'}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>r = {correlation.toFixed(3)}</span>
      </div>

      {/* Match score bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
          <span>매칭 정확도</span><span style={{ fontWeight: 700, color: '#1e293b' }}>{score}%</span>
        </div>
        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score}%`, background: pattern.color, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 12px' }}>{pattern.description}</p>

      {/* Key points */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pattern.keyPoints.map((pt, i) => (
          <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, color: '#475569' }}>
            {pt}
          </span>
        ))}
      </div>
    </div>
  )
}
