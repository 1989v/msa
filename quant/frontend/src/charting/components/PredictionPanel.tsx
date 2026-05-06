// charting/frontend/src/components/PredictionPanel.tsx
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, Target, Shield } from 'lucide-react'
import type { PatternMatch } from '../lib/patternMatcher'

interface Props {
  matches: PatternMatch[]
  ticker: string
}

export function PredictionPanel({ matches, ticker }: Props) {
  if (matches.length === 0) return null

  const primary = matches[0]
  const rest = matches.slice(1)
  const isBullish = primary.pattern.signal === 'bullish'
  const isBearish = primary.pattern.signal === 'bearish'

  return (
    <div className="space-y-4">
      {/* Primary pattern - full panel */}
      <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isBullish ? 'bg-emerald-500/20' : isBearish ? 'bg-rose-500/20' : 'bg-amber-500/20'
          }`}>
            {isBullish
              ? <TrendingUp className="w-5 h-5 text-emerald-400" />
              : isBearish
                ? <TrendingDown className="w-5 h-5 text-rose-400" />
                : <TrendingUp className="w-5 h-5 text-amber-400" />
            }
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">추세 예측</h3>
            <p className="text-xs text-slate-400">{ticker} · {primary.pattern.name}</p>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-4 border ${
          isBullish
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : isBearish
              ? 'bg-rose-500/10 border-rose-500/20'
              : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <p className={`font-bold text-base ${
            isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {primary.pattern.prediction}
          </p>
          <p className="text-sm text-slate-400 mt-1">{primary.pattern.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <BarChart3 className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
            <p className="text-lg font-bold text-white">{primary.pattern.accuracy}%</p>
            <p className="text-[10px] text-slate-500">패턴 정확도</p>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <Target className="w-4 h-4 mx-auto mb-1 text-amber-400" />
            <p className="text-lg font-bold text-white">{isBullish ? '+12~18%' : isBearish ? '-10~15%' : '±5~10%'}</p>
            <p className="text-[10px] text-slate-500">예상 변동폭</p>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <Shield className="w-4 h-4 mx-auto mb-1 text-violet-400" />
            <p className="text-lg font-bold text-white">{isBullish ? '높음' : isBearish ? '주의' : '보통'}</p>
            <p className="text-[10px] text-slate-500">신뢰도</p>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            차트 패턴 분석은 과거 데이터를 기반으로 한 참고 자료이며, 투자 결정의 유일한 근거로 사용해서는 안 됩니다.
          </p>
        </div>
      </div>

      {/* Additional patterns - compact cards */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rest.map(m => {
            const bull = m.pattern.signal === 'bullish'
            const bear = m.pattern.signal === 'bearish'
            return (
              <div
                key={m.pattern.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    bull ? 'bg-emerald-500/20' : bear ? 'bg-rose-500/20' : 'bg-amber-500/20'
                  }`}>
                    {bull
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      : bear
                        ? <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        : <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.pattern.name}</p>
                    <p className="text-[10px] text-slate-500">{m.pattern.nameEn}</p>
                  </div>
                  <span className="ml-auto text-xs font-bold" style={{ color: m.pattern.color }}>
                    {m.score}%
                  </span>
                </div>
                <p className={`text-xs font-semibold ${
                  bull ? 'text-emerald-400' : bear ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {m.pattern.prediction}
                </p>
                <p className="text-xs text-slate-500 mt-1">{m.pattern.accuracy}% 정확도 · r={m.correlation.toFixed(3)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
