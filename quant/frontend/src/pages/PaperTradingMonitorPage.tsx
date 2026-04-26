import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { RealtimePricePanel } from '@/components/paper/RealtimePricePanel'
import {
    TrancheSlotGrid,
    type SlotInfo,
} from '@/components/paper/TrancheSlotGrid'
import { PaperExecutionTimeline } from '@/components/paper/PaperExecutionTimeline'
import { usePaperStream } from '@/hooks/usePaperStream'
import { getStrategy } from '@/api/strategies'
import { toApiError } from '@/api/client'
import type { PaperSlotState } from '@/api/sse/paperStream'

/**
 * 페이퍼 트레이딩 모니터링 페이지.
 *
 * 레이아웃 (모바일 우선):
 *   1. 활성 전략 카드 — 누적 PnL / 회차 회전률 / 종목 (REST snapshot 후속)
 *   2. RealtimePricePanel — 실시간 시세 (SSE tick)
 *   3. TrancheSlotGrid — 회차 슬롯 색상 표시 (SSE slot)
 *   4. PaperExecutionTimeline — 가상 체결 타임라인 (SSE order)
 *
 * 단순화 (Phase 2):
 *   - REST snapshot hydrate 미구현 → 슬롯 초기 상태는 strategy.config.roundCount 기반 EMPTY 채움
 *   - 다중 거래쌍 탭 미구현 → strategy.config.targetSymbol 단일 사용
 *   - 누적 PnL / 회차 회전률 → 후속 status endpoint 정합 후 hydrate
 */
export function PaperTradingMonitorPage() {
    const { id } = useParams<{ id: string }>()
    const strategyQ = useQuery({
        queryKey: ['strategy', id],
        queryFn: () => getStrategy(id!),
        enabled: !!id,
    })

    // 거래쌍은 strategy.config.targetSymbol 우선, fallback BTC_KRW
    const symbol = strategyQ.data?.config.targetSymbol ?? null
    const [overrideSymbol] = useState<string | null>(null)
    const effectiveSymbol = overrideSymbol ?? symbol ?? 'BTC_KRW'

    const stream = usePaperStream(id ?? '', effectiveSymbol)

    // SSE slot delta 와 strategy.config.roundCount 를 머지하여 안정적인 그리드 산출
    const slots = useMemo<SlotInfo[]>(() => {
        const roundCount = strategyQ.data?.config.roundCount ?? 0
        if (roundCount === 0) return []
        return Array.from({ length: roundCount }, (_, i) => {
            const snap = stream.slots[i]
            return {
                roundIndex: i,
                state: (snap?.state ?? 'EMPTY') as PaperSlotState,
                entryPrice: snap?.entryPrice,
            }
        })
    }, [strategyQ.data?.config.roundCount, stream.slots])

    if (!id) return null

    return (
        <>
            <PageHeader
                title="페이퍼 트레이딩 모니터링"
                subtitle={
                    strategyQ.data
                        ? strategyQ.data.config.targetSymbol.replace('_', '/')
                        : undefined
                }
                back={`/strategies/${id}`}
            />

            <div className="space-y-4 px-4 py-4">
                {strategyQ.isLoading && (
                    <Card className="space-y-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-6 w-3/4" />
                    </Card>
                )}
                {strategyQ.isError && (
                    <ErrorBanner
                        error={toApiError(strategyQ.error)}
                        onRetry={() => strategyQ.refetch()}
                    />
                )}

                {strategyQ.data && (
                    <Card className="space-y-2">
                        <CardHeader>
                            <CardTitle>활성 전략</CardTitle>
                        </CardHeader>
                        <dl className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                                <dt className="text-ink-500">종목</dt>
                                <dd className="font-semibold text-ink-900 tabular-nums">
                                    {strategyQ.data.config.targetSymbol.replace(
                                        '_',
                                        '/',
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-ink-500">회차</dt>
                                <dd className="font-semibold text-ink-900 tabular-nums">
                                    {strategyQ.data.config.roundCount}회
                                </dd>
                            </div>
                            <div>
                                <dt className="text-ink-500">상태</dt>
                                <dd className="font-semibold text-ink-900">
                                    {strategyQ.data.status}
                                </dd>
                            </div>
                        </dl>
                        <p className="text-xs text-ink-400">
                            누적 PnL / 회차 회전률 — 후속 hydrate 예정
                        </p>
                    </Card>
                )}

                <RealtimePricePanel
                    symbol={effectiveSymbol}
                    price={stream.latestPrice}
                    connected={stream.connected}
                />

                <TrancheSlotGrid slots={slots} />

                <PaperExecutionTimeline executions={stream.executions} />
            </div>
        </>
    )
}
