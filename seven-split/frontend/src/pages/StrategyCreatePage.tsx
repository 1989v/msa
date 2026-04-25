import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StrategyForm } from '@/components/strategy/StrategyForm'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { createStrategy } from '@/api/strategies'
import { toApiError, type ApiError } from '@/api/client'
import type { CreateStrategyRequest } from '@/types/api'

export function StrategyCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<ApiError | null>(null)

  const mutation = useMutation({
    mutationFn: (req: CreateStrategyRequest) => createStrategy(req),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      navigate(`/strategies/${data.strategyId}`, { replace: true })
    },
    onError: (err) => {
      setError(toApiError(err))
    },
  })

  async function handleSubmit(req: CreateStrategyRequest) {
    setError(null)
    await mutation.mutateAsync(req).catch(() => {
      // mutation onError 가 setError 처리
    })
  }

  return (
    <>
      <PageHeader title="새 전략" subtitle="회차/매수 간격/익절 % 설정" back />
      <div className="px-4 py-4 space-y-4">
        {error && <ErrorBanner error={error} onRetry={() => setError(null)} />}
        <StrategyForm onSubmit={handleSubmit} submitting={mutation.isPending} />
      </div>
    </>
  )
}
