import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/Badge'
import { StrategyConfigBadge } from '@/components/strategy/StrategyConfigBadge'
import { BacktestSummaryCard } from '@/components/backtest/BacktestSummaryCard'
import { getStrategy } from '@/api/strategies'
import { listRuns } from '@/api/backtests'
import { toApiError } from '@/api/client'

export function StrategyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const strategyQ = useQuery({
    queryKey: ['strategy', id],
    queryFn: () => getStrategy(id!),
    enabled: !!id,
  })
  const runsQ = useQuery({
    queryKey: ['strategy', id, 'runs'],
    queryFn: () => listRuns(id!),
    enabled: !!id,
  })

  if (!id) return null

  return (
    <>
      <PageHeader
        title={strategyQ.data ? strategyQ.data.config.targetSymbol.replace('_', '/') : '전략 상세'}
        subtitle={strategyQ.data ? `${strategyQ.data.config.roundCount}회차 분할` : undefined}
        back="/strategies"
        rightSlot={strategyQ.data && <StatusBadge status={strategyQ.data.status} />}
      />

      <div className="px-4 py-4 space-y-6">
        {strategyQ.isLoading && (
          <Card className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </Card>
        )}
        {strategyQ.isError && (
          <ErrorBanner error={toApiError(strategyQ.error)} onRetry={() => strategyQ.refetch()} />
        )}
        {strategyQ.data && (
          <Card className="space-y-3">
            <CardHeader>
              <CardTitle>설정</CardTitle>
            </CardHeader>
            <StrategyConfigBadge config={strategyQ.data.config} />
            <div className="space-y-1 text-sm text-ink-600 tabular-nums">
              <div>
                회차별 익절 %:{' '}
                <span className="text-ink-900">
                  {strategyQ.data.config.takeProfitPercentPerRound
                    .map((v) => `+${v}%`)
                    .join(', ')}
                </span>
              </div>
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <Link to={`/strategies/${id}/backtests/new`}>
            <Button size="lg" fullWidth>
              <Play size={20} aria-hidden />새 백테스트 시작
            </Button>
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">백테스트 결과</h2>
          {runsQ.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          )}
          {runsQ.isError && (
            <ErrorBanner error={toApiError(runsQ.error)} onRetry={() => runsQ.refetch()} />
          )}
          {runsQ.data && runsQ.data.length === 0 && (
            <EmptyState
              title="첫 백테스트를 돌려보세요."
              description="기간을 설정하고 결과를 비교할 수 있습니다."
              action={
                <Link to={`/strategies/${id}/backtests/new`}>
                  <Button size="md">백테스트 시작</Button>
                </Link>
              }
            />
          )}
          {runsQ.data && runsQ.data.length > 0 && (
            <ul className="space-y-2">
              {runsQ.data.map((run) => (
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
