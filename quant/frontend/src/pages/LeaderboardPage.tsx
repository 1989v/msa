import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { getLeaderboard } from '@/api/leaderboard'
import { toApiError } from '@/api/client'

export function LeaderboardPage() {
  const q = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => getLeaderboard(20),
  })

  return (
    <>
      <PageHeader title="리더보드" subtitle="본인 운용 성과 비교 (외부 비공개)" />
      <div className="px-4 py-4 space-y-3">
        {q.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        )}
        {q.isError && <ErrorBanner error={toApiError(q.error)} onRetry={() => q.refetch()} />}
        {q.data && q.data.length === 0 && (
          <EmptyState
            icon={<Trophy size={28} aria-hidden />}
            title="랭킹할 백테스트 결과가 없습니다."
            description="여러 파라미터로 백테스트를 돌려 비교해보세요."
          />
        )}
        {q.data && q.data.length > 0 && (
          <ul className="space-y-2">
            {q.data.map((entry) => (
              <li key={entry.runId}>
                <LeaderboardRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
