// charting/frontend/src/components/PatternSelector.tsx
import type { PatternMatch } from '../lib/patternMatcher'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  matches: PatternMatch[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}

export function PatternSelector({ matches, selectedIds, onToggle }: Props) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-500">종목을 선택하면 패턴 분석이 시작됩니다.</p>
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      {matches.map(m => {
        const active = selectedIds.has(m.pattern.id)
        const Icon = m.pattern.signal === 'bullish' ? TrendingUp : m.pattern.signal === 'bearish' ? TrendingDown : Minus

        return (
          <button
            key={m.pattern.id}
            onClick={() => onToggle(m.pattern.id)}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 border ${
              active
                ? 'bg-slate-800 border-slate-600 shadow-lg'
                : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/60 hover:border-slate-600/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-white">{m.pattern.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded border ${
                    m.pattern.signal === 'bullish'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : m.pattern.signal === 'bearish'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {m.pattern.signal === 'bullish' ? '상승' : m.pattern.signal === 'bearish' ? '하락' : '중립'}
                </span>
                <span className="text-xs text-slate-500">{m.score}%</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">{m.pattern.nameEn}</p>
            {active && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <p className="text-xs text-slate-400 leading-relaxed">{m.pattern.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">정확도</span>
                  <span className="text-xs font-bold" style={{ color: m.pattern.color }}>{m.pattern.accuracy}%</span>
                </div>
                <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${m.pattern.accuracy}%`, background: m.pattern.color }}
                  />
                </div>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
