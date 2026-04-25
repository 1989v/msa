import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, LineChart } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StrategyCard } from '@/components/strategy/StrategyCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { listStrategies } from '@/api/strategies'
import { toApiError } from '@/api/client'

export function StrategyListPage() {
  const q = useQuery({
    queryKey: ['strategies'],
    queryFn: listStrategies,
    retry: 1,
  })

  return (
    <>
      <PageHeader
        title="전략"
        rightSlot={
          <Link
            to="/strategies/new"
            aria-label="새 전략 만들기"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink-900 text-ink-50 hover:bg-ink-800 active:bg-ink-950 transition-colors"
          >
            <Plus size={22} aria-hidden />
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-3">
        {q.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        )}
        {q.isError && (
          <ErrorBanner error={toApiError(q.error)} onRetry={() => q.refetch()} />
        )}
        {q.data && q.data.length === 0 && (
          <EmptyState
            icon={<LineChart size={28} aria-hidden />}
            title="아직 등록된 전략이 없습니다."
            description="회차/매수 간격/익절 %를 정해 첫 전략을 만들어보세요."
            action={
              <Link to="/strategies/new">
                <Button size="md">전략 만들기</Button>
              </Link>
            }
          />
        )}
        {q.data && q.data.length > 0 && (
          <ul className="space-y-2">
            {q.data.map((s) => (
              <li key={s.strategyId}>
                <StrategyCard strategy={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
