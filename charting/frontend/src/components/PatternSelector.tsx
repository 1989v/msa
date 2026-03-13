// charting/frontend/src/components/PatternSelector.tsx
import type { PatternMatch } from '../lib/patternMatcher'
import type { Signal } from '../lib/patterns'

interface Props {
  matches: PatternMatch[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}

const SIGNAL_BADGE: Record<Signal, { bg: string; text: string; label: string }> = {
  bullish: { bg: '#dcfce7', text: '#15803d', label: '▲' },
  bearish: { bg: '#fee2e2', text: '#b91c1c', label: '▼' },
  neutral: { bg: '#fef9c3', text: '#a16207', label: '→' },
}

export function PatternSelector({ matches, selectedIds, onToggle }: Props) {
  if (matches.length === 0) {
    return <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>종목을 선택하면 패턴 분석이 시작됩니다.</div>
  }

  return (
    <div style={{ padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>
        패턴 선택 <span style={{ fontWeight: 400, color: '#9ca3af' }}>({selectedIds.size}개 선택)</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {matches.map(m => {
          const active = selectedIds.has(m.pattern.id)
          const badge = SIGNAL_BADGE[m.pattern.signal]
          return (
            <button
              key={m.pattern.id}
              onClick={() => onToggle(m.pattern.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                border: active ? `2px solid ${m.pattern.color}` : '2px solid #e2e8f0',
                background: active ? `${m.pattern.color}18` : '#f8fafc',
                color: active ? m.pattern.color : '#64748b',
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: active ? m.pattern.color : '#cbd5e1',
                display: 'inline-block', flexShrink: 0,
              }} />
              {m.pattern.name}
              <span style={{ fontSize: 10, color: badge.text, background: badge.bg, padding: '1px 4px', borderRadius: 4 }}>
                {badge.label}
              </span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{m.score}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
