export type Period = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y'

const PERIODS: { value: Period; label: string }[] = [
  { value: '1D', label: '1일' },
  { value: '1W', label: '1주' },
  { value: '1M', label: '1개월' },
  { value: '3M', label: '3개월' },
  { value: '1Y', label: '1년' },
  { value: '5Y', label: '5년' },
]

interface Props {
  value: Period
  onChange: (period: Period) => void
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === p.value
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
