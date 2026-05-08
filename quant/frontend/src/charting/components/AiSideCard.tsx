// charting/components/AiSideCard.tsx
//
// 데스크톱 (≥ lg) 우측 sticky 사이드 카드 — AI 자연어 요약 + 유력 매치 1개 + 미니 예측 KPI.
// 모바일에서는 노출 안 됨 (탭 안 'AI 인사이트' 가 풀 콘텐츠).
import type { ReactNode } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'

interface Props {
  /** AI 자연어 요약 (caller 가 미리 생성) */
  summary: string
  /** Top 패턴 매치 (있으면) */
  topMatch?: {
    label: string
    score: number
    color: string
  }
  /** 평균 수익률 예측 (옵션) */
  prediction?: {
    sample: number
    avgReturn5d: string | null
    avgReturn20d: string | null
  } | null
  /** "전체 인사이트 보기" 액션 — AI 인사이트 탭으로 점프 */
  onSeeMore?: () => void
}

export function AiSideCard({ summary, topMatch, prediction, onSeeMore }: Props) {
  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{
        background: 'var(--ko-surface-1)',
        border: '1px solid var(--ko-border-subtle)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background:
              'color-mix(in oklch, var(--ko-accent-primary) 18%, transparent)',
            color: 'var(--ko-accent-primary-hover)',
          }}
          aria-hidden="true"
        >
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <div
            className="text-[10px] uppercase tracking-wide"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            AI 인사이트
          </div>
          <div
            className="text-xs font-semibold"
            style={{ color: 'var(--ko-text-primary)' }}
          >
            한 줄 요약
          </div>
        </div>
      </div>

      <p
        className="text-sm leading-relaxed"
        style={{ color: 'var(--ko-text-secondary)' }}
      >
        {summary || '데이터를 분석할 충분한 히스토리가 없습니다.'}
      </p>

      {topMatch && (
        <Section label="유력 패턴">
          <div
            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg"
            style={{
              background: 'var(--ko-surface-2)',
              border: '1px solid var(--ko-border-subtle)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: topMatch.color }}
                aria-hidden="true"
              />
              <span
                className="text-sm truncate"
                style={{ color: 'var(--ko-text-primary)' }}
              >
                {topMatch.label}
              </span>
            </div>
            <span
              className="text-xs font-semibold tabular-nums shrink-0"
              style={{ color: 'var(--ko-accent-primary-hover)' }}
            >
              {Math.round(topMatch.score)}%
            </span>
          </div>
        </Section>
      )}

      {prediction && prediction.sample > 0 && (
        <Section label={`kNN 예측 (n=${prediction.sample})`}>
          <div className="grid grid-cols-2 gap-2">
            <MiniReturnKpi label="5d" pctStr={prediction.avgReturn5d} />
            <MiniReturnKpi label="20d" pctStr={prediction.avgReturn20d} />
          </div>
        </Section>
      )}

      {onSeeMore && (
        <button
          type="button"
          onClick={onSeeMore}
          className="w-full text-xs py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
          style={{
            background:
              'color-mix(in oklch, var(--ko-accent-primary) 18%, transparent)',
            color: 'var(--ko-accent-primary-hover)',
          }}
        >
          전체 인사이트 보기
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function MiniReturnKpi({
  label,
  pctStr,
}: {
  label: string
  pctStr: string | null
}) {
  const n = pctStr != null ? parseFloat(pctStr) : NaN
  const finite = Number.isFinite(n)
  const isUp = finite && n > 0
  return (
    <div
      className="rounded-lg px-2 py-1.5"
      style={{
        background: 'var(--ko-surface-2)',
        border: '1px solid var(--ko-border-subtle)',
      }}
    >
      <div
        className="text-[10px]"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        {label}
      </div>
      <div
        className="text-sm font-semibold tabular-nums"
        style={{
          color: !finite
            ? 'var(--ko-text-muted)'
            : isUp
              ? 'var(--ko-status-profit)'
              : 'var(--ko-status-loss)',
        }}
      >
        {finite ? `${(n * 100).toFixed(2)}%` : '—'}
      </div>
    </div>
  )
}
