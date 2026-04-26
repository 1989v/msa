import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { BacktestRunChart } from '@/components/backtest/BacktestRunChart'
import { ExecutionTimeline } from '@/components/backtest/ExecutionTimeline'
import { PnLBreakdown } from '@/components/backtest/PnLBreakdown'
import { getRun } from '@/api/backtests'
import { toApiError } from '@/api/client'
import {
  daysBetween,
  formatDateTime,
  formatKrw,
  formatSymbol,
  pnlColorClass,
  pnlSign,
} from '@/lib/format'
import { cn } from '@/lib/cn'

export function BacktestRunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const q = useQuery({
    queryKey: ['run', runId],
    queryFn: () => getRun(runId!),
    enabled: !!runId,
  })

  return (
    <>
      <PageHeader
        title={q.data ? formatSymbol(q.data.symbol) : '백테스트 결과'}
        subtitle={q.data ? `${daysBetween(q.data.fromTs, q.data.toTs)}일 백테스트` : undefined}
        back
      />

      <div className="px-4 py-4 space-y-6">
        {q.isLoading && (
          <>
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </>
        )}
        {q.isError && <ErrorBanner error={toApiError(q.error)} onRetry={() => q.refetch()} />}

        {q.data && (
          <>
            {/* Summary */}
            <Card className="space-y-2">
              <div className="text-sm text-ink-500">실현 PnL</div>
              <div
                className={cn(
                  'text-2xl font-semibold tabular-nums',
                  pnlColorClass(q.data.realizedPnl),
                )}
              >
                {pnlSign(q.data.realizedPnl)}
                {formatKrw(q.data.realizedPnl)}
              </div>
              <dl className="grid grid-cols-2 gap-3 pt-2 text-sm">
                <div>
                  <dt className="text-ink-500">체결 수</dt>
                  <dd className="text-ink-900 tabular-nums">
                    {q.data.fillCount.toLocaleString('ko-KR')}건
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">MDD</dt>
                  <dd className="text-pnl-down tabular-nums">{q.data.mdd}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-ink-500">기간</dt>
                  <dd className="text-ink-900 tabular-nums">
                    {formatDateTime(q.data.fromTs)} ~ {formatDateTime(q.data.toTs)}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Chart */}
            <section className="space-y-2" aria-label="가격 + 체결 마커">
              <h2 className="text-lg font-semibold text-ink-900">가격 차트</h2>
              <BacktestRunChart fills={q.data.fills} />
            </section>

            {/* PnL by round */}
            {q.data.pnlByRound && q.data.pnlByRound.length > 0 && (
              <section className="space-y-2" aria-label="회차별 손익">
                <h2 className="text-lg font-semibold text-ink-900">회차별 손익</h2>
                <Card>
                  <PnLBreakdown items={q.data.pnlByRound} />
                </Card>
              </section>
            )}

            {/* Timeline */}
            <section className="space-y-2" aria-label="체결 타임라인">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-ink-900">체결 타임라인</h2>
                <span className="text-sm text-ink-500 tabular-nums">
                  {q.data.fills.length}건
                </span>
              </div>
              <ExecutionTimeline fills={q.data.fills} />
            </section>
          </>
        )}
      </div>
    </>
  )
}
