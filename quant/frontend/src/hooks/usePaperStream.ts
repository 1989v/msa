import { useEffect, useState } from 'react'
import {
    PaperStreamClient,
    type PaperOrderEvent,
    type PaperSlotEvent,
    type PaperSlotState,
} from '@/api/sse/paperStream'
import { useTenantId } from './useTenantId'

export interface PaperSlotSnapshot {
    roundIndex: number
    state: PaperSlotState
    entryPrice?: string
}

export interface PaperStreamState {
    /** 최근 tick 가격 (BigDecimal serialized) */
    latestPrice: string | null
    /** 최근 tick timestamp (ISO-8601) */
    priceTs: string | null
    /** SSE 연결 상태 */
    connected: boolean
    /** 마지막 에러 (재연결은 client 내부에서 자동) */
    error: Event | null
    /** 회차 슬롯 상태 (delta 누적) */
    slots: Record<number, PaperSlotSnapshot>
    /** 최근 체결 (head=최신, 최대 50개 유지) */
    executions: PaperOrderEvent[]
}

const MAX_EXECUTIONS = 50

const INITIAL_STATE: PaperStreamState = {
    latestPrice: null,
    priceTs: null,
    connected: false,
    error: null,
    slots: {},
    executions: [],
}

/**
 * 페이퍼 트레이딩 SSE 구독 훅.
 *
 * - strategyId 가 변하면 재구독 (이전 client는 disconnect)
 * - tenantId 변경 시에도 재구독 (multi-tenant 토큰 변경 대응)
 * - state 는 client 콜백에서 setState 로 누적
 *
 * 한계 (Phase 2):
 * - 초기 hydrate (REST snapshot) 미적용 → SSE 이벤트만으로 점진 채움
 * - 다중 거래쌍 분기 미적용 → 단일 symbol
 */
export function usePaperStream(
    strategyId: string,
    symbol: string | null,
): PaperStreamState {
    const { tenantId } = useTenantId()
    const [state, setState] = useState<PaperStreamState>(INITIAL_STATE)

    useEffect(() => {
        if (!strategyId) return
        // 새 구독 시작 시 누적 state 초기화 (전략 변경 = 컨텍스트 전환)
        setState(INITIAL_STATE)

        // 단순화: authToken = tenantId (실 JWT 발급은 Phase 3)
        const client = new PaperStreamClient(strategyId, symbol, tenantId, {
            onTick: (data) =>
                setState((s) => ({
                    ...s,
                    latestPrice: data.price,
                    priceTs: data.ts,
                })),
            onSlot: (data: PaperSlotEvent) =>
                setState((s) => ({
                    ...s,
                    slots: {
                        ...s.slots,
                        [data.roundIndex]: {
                            roundIndex: data.roundIndex,
                            state: data.state,
                            entryPrice: data.entryPrice,
                        },
                    },
                })),
            onOrder: (data: PaperOrderEvent) =>
                setState((s) => ({
                    ...s,
                    executions: [data, ...s.executions].slice(0, MAX_EXECUTIONS),
                })),
            onOpen: () =>
                setState((s) => ({ ...s, connected: true, error: null })),
            onError: (e) =>
                setState((s) => ({ ...s, connected: false, error: e })),
        })
        client.connect()
        return () => client.disconnect()
    }, [strategyId, symbol, tenantId])

    return state
}
