// charting/frontend/src/components/PatternSelector.tsx
import React from 'react'
import type { PatternMatch } from '../lib/patternMatcher'
import type { Signal } from '../lib/patterns'

interface Props {
  matches: PatternMatch[]
  selectedId: string
  onChange: (id: string) => void
}

const SIGNAL_STYLE: Record<Signal, { bg: string; text: string; label: string }> = {
  bullish: { bg: '#dcfce7', text: '#15803d', label: '🟢 상승' },
  bearish: { bg: '#fee2e2', text: '#b91c1c', label: '🔴 하락' },
  neutral: { bg: '#fef9c3', text: '#a16207', label: '🟡 중립' },
}

export function PatternSelector({ matches, selectedId, onChange }: Props) {
  const selected = matches.find(m => m.pattern.id === selectedId) ?? matches[0]

  if (matches.length === 0) {
    return <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>종목을 선택하면 패턴 분석이 시작됩니다.</div>
  }

  const sig = selected ? SIGNAL_STYLE[selected.pattern.signal] : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>패턴 선택</label>

      <select
        value={selectedId}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, maxWidth: 300, padding: '6px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 600, background: '#fff' }}
      >
        {matches.map(m => (
          <option key={m.pattern.id} value={m.pattern.id}>
            {m.pattern.name} — {m.score}% 일치
          </option>
        ))}
      </select>

      {sig && (
        <span style={{ padding: '4px 12px', borderRadius: 20, background: sig.bg, color: sig.text, fontSize: 12, fontWeight: 700 }}>
          {sig.label}
        </span>
      )}

      {selected && (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          매칭률: <strong style={{ color: '#1e293b' }}>{selected.score}%</strong>
        </span>
      )}
    </div>
  )
}
