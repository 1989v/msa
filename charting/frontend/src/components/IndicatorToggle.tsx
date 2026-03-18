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
    <div className="flex flex-wrap gap-2">
      {BUTTONS.map(({ key, label, color }) => {
        const active = value[key]
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-150 cursor-pointer ${
              active
                ? 'text-white'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
            }`}
            style={active ? { background: color, borderColor: color, color: '#fff' } : undefined}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
