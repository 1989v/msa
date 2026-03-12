// charting/frontend/src/components/IndicatorToggle.tsx

export interface Indicators {
  ma5: boolean
  ma20: boolean
  ma60: boolean
  bb: boolean
  volume: boolean
  rsi: boolean
  macd: boolean
}

interface Props {
  value: Indicators
  onChange: (next: Indicators) => void
}

const BUTTONS: { key: keyof Indicators; label: string; color: string }[] = [
  { key: 'ma5',    label: 'MA5',    color: '#f59e0b' },
  { key: 'ma20',   label: 'MA20',   color: '#3b82f6' },
  { key: 'ma60',   label: 'MA60',   color: '#a855f7' },
  { key: 'bb',     label: 'BB',     color: '#06b6d4' },
  { key: 'volume', label: 'VOL',    color: '#6b7280' },
  { key: 'rsi',    label: 'RSI',    color: '#10b981' },
  { key: 'macd',   label: 'MACD',   color: '#ef4444' },
]

export function IndicatorToggle({ value, onChange }: Props) {
  const toggle = (key: keyof Indicators) =>
    onChange({ ...value, [key]: !value[key] })

  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
      {BUTTONS.map(({ key, label, color }) => {
        const active = value[key]
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              border: `1.5px solid ${active ? color : '#d1d5db'}`,
              borderRadius: 20,
              background: active ? color : '#fff',
              color: active ? '#fff' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
