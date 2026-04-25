import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { BacktestSummaryCard } from '@/components/backtest/BacktestSummaryCard'
import {
  getDashboardExecutions,
  getDashboardOverview,
} from '@/api/dashboard'
import { toApiError } from '@/api/client'
import {
  formatDateTime,
  formatKrw,
  pnlColorClass,
  pnlSign,
} from '@/lib/format'
import { cn } from '@/lib/cn'

export function HomePage() {
  const overviewQ = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
    retry: 1,
  })
  const executionsQ = useQuery({
    queryKey: ['dashboard', 'executions'],
    queryFn: getDashboardExecutions,
    retry: 1,
  })

  return (
    <>
      <PageHeader
        title="Seven-Split"
        subtitle="세븐스플릿 분할매매 대시보드"
      />

      <div className="px-4 py-4 space-y-6">
        {/* 누적 요약 */}
        <section aria-label="누적 요약">
          {overviewQ.isLoading && (
            <Card className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-32" />
            </Card>
          )}
          {overviewQ.isError && (
            <ErrorBanner error={toApiError(overviewQ.error)} onRetry={() => overviewQ.refetch()} />
          )}
          {overviewQ.data && (
            <Card className="space-y-3">
              <div className="text-sm text-ink-500">누적 실현 PnL</div>
              <div
                className={cn(
                  'text-3xl font-semibold tabular-nums',
                  pnlColorClass(overviewQ.data.cumulativeRealizedPnl),
                )}
              >
                {pnlSign(overviewQ.data.cumulativeRealizedPnl)}
                {formatKrw(overviewQ.data.cumulativeRealizedPnl)}
              </div>
              <div className="flex items-center gap-4 text-sm text-ink-600 tabular-nums">
                <span>전략 {overviewQ.data.totalStrategies}개</span>
                <span aria-hidden className="text-ink-300">·</span>
                <span>백테스트 {overviewQ.data.totalBacktests}회</span>
                <span aria-hidden className="text-ink-300">·</span>
                <span>체결 {overviewQ.data.totalFills.toLocaleString('ko-KR')}건</span>
              </div>
              {overviewQ.data.lastRunEndedAt && (
                <div className="text-xs text-ink-400">
                  마지막 실행 {formatDateTime(overviewQ.data.lastRunEndedAt)}
                </div>
              )}
            </Card>
          )}
        </section>

        {/* CTA */}
        <section>
          <Link to="/strategies/new" aria-label="새 전략 만들기">
            <Button size="lg" fullWidth>
              <Plus size={20} aria-hidden />
              새 전략 만들기
            </Button>
          </Link>
        </section>

        {/* 최근 백테스트 */}
        <section aria-label="최근 백테스트" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink-900">최근 백테스트</h2>
            <Link
              to="/runs"
              className="text-sm text-brand-600 hover:underline underline-offset-2"
            >
              전체 보기
            </Link>
          </div>

          {executionsQ.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          )}
          {executionsQ.isError && (
            <ErrorBanner error={toApiError(executionsQ.error)} onRetry={() => executionsQ.refetch()} />
          )}
          {executionsQ.data && executionsQ.data.length === 0 && (
            <EmptyState
              icon={<TrendingUp size={28} aria-hidden />}
              title="아직 백테스트 결과가 없습니다."
              description="전략을 만들고 첫 백테스트를 돌려보세요."
              action={
                <Link to="/strategies/new">
                  <Button size="md">전략 만들기</Button>
                </Link>
              }
            />
          )}
          {executionsQ.data && executionsQ.data.length > 0 && (
            <ul className="space-y-2">
              {executionsQ.data.slice(0, 5).map((run) => (
                <li key={run.runId}>
                  <BacktestSummaryCard run={run} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
