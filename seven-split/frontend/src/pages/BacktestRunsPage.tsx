import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { BacktestSummaryCard } from '@/components/backtest/BacktestSummaryCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { getDashboardExecutions } from '@/api/dashboard'
import { toApiError } from '@/api/client'

/**
 * BottomTabBar 의 "백테스트" 탭 목적지.
 * 모든 전략의 백테스트 결과를 종합해서 표시 (백엔드 dashboard.executions 활용).
 */
export function BacktestRunsPage() {
  const q = useQuery({
    queryKey: ['dashboard', 'executions'],
    queryFn: getDashboardExecutions,
  })

  return (
    <>
      <PageHeader title="백테스트" subtitle="모든 전략 결과" />
      <div className="px-4 py-4 space-y-3">
        {q.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        )}
        {q.isError && <ErrorBanner error={toApiError(q.error)} onRetry={() => q.refetch()} />}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="실행한 백테스트가 없습니다."
            description="전략을 만들고 백테스트를 돌려보세요."
          />
        )}
        {q.data && q.data.length > 0 && (
          <ul className="space-y-2">
            {q.data.map((run) => (
              <li key={run.runId}>
                <BacktestSummaryCard run={run} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
