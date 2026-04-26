/**
 * 페이퍼 트레이딩 모니터링 SSE 클라이언트.
 *
 * - 단일 전략에 대한 실시간 tick / slot / order 이벤트 구독
 * - EventSource 기반 (SSE) — Phase 2 단순화 (Phase 3에서 first-message 인증 도입 예정)
 * - 지수 백오프 자동 재연결
 *
 * 백엔드 엔드포인트:
 *   GET /api/v1/strategies/{strategyId}/paper/sse?symbol=...&authToken=...
 *   - X-User-Id 헤더 대신 query param authToken 사용 (EventSource는 커스텀 헤더 미지원)
 */

export interface PaperTickEvent {
    symbol: string
    price: string
    ts: string
}

export type PaperSlotState =
    | 'EMPTY'
    | 'PENDING_BUY'
    | 'FILLED'
    | 'PENDING_SELL'
    | 'CLOSED'

export interface PaperSlotEvent {
    roundIndex: number
    state: PaperSlotState
    entryPrice?: string
}

export interface PaperOrderEvent {
    roundIndex: number
    side: 'BUY' | 'SELL'
    price: string
    ts: string
}

export interface PaperStreamHandlers {
    onTick?: (data: PaperTickEvent) => void
    onSlot?: (data: PaperSlotEvent) => void
    onOrder?: (data: PaperOrderEvent) => void
    onError?: (e: Event) => void
    onOpen?: () => void
}

export class PaperStreamClient {
    private eventSource: EventSource | null = null
    private reconnectAttempt = 0
    private reconnectTimeout: number | null = null
    private disposed = false

    constructor(
        private readonly strategyId: string,
        private readonly symbol: string | null,
        private readonly authToken: string,
        private readonly handlers: PaperStreamHandlers,
    ) {}

    connect(): void {
        if (this.disposed) return
        const baseUrl =
            import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8094'
        const params = new URLSearchParams()
        if (this.symbol) params.set('symbol', this.symbol)
        // 단순화: query param 으로 인증 토큰 전달 (Phase 3 first-message 인증으로 대체 예정)
        params.set('authToken', this.authToken)
        const url = `${baseUrl}/api/v1/strategies/${this.strategyId}/paper/sse?${params.toString()}`

        const es = new EventSource(url, { withCredentials: false })
        this.eventSource = es

        es.addEventListener('tick', (e) => {
            try {
                const data = JSON.parse(
                    (e as MessageEvent).data,
                ) as PaperTickEvent
                this.handlers.onTick?.(data)
            } catch (err) {
                // 파싱 실패는 단일 이벤트로 흘려보낸다 (재연결 트리거 X)
                console.warn('[paperStream] tick parse failed', err)
            }
        })

        es.addEventListener('slot', (e) => {
            try {
                const data = JSON.parse(
                    (e as MessageEvent).data,
                ) as PaperSlotEvent
                this.handlers.onSlot?.(data)
            } catch (err) {
                console.warn('[paperStream] slot parse failed', err)
            }
        })

        es.addEventListener('order', (e) => {
            try {
                const data = JSON.parse(
                    (e as MessageEvent).data,
                ) as PaperOrderEvent
                this.handlers.onOrder?.(data)
            } catch (err) {
                console.warn('[paperStream] order parse failed', err)
            }
        })

        es.onopen = () => {
            this.reconnectAttempt = 0
            this.handlers.onOpen?.()
        }

        es.onerror = (e) => {
            this.handlers.onError?.(e)
            // EventSource는 자체 재연결을 시도하지만, 명시적으로 백오프 재연결 제어
            this.scheduleReconnect()
        }
    }

    private scheduleReconnect(): void {
        if (this.disposed) return
        if (this.reconnectTimeout != null) return
        const delay = Math.min(5000, 1000 * Math.pow(2, this.reconnectAttempt))
        this.reconnectAttempt++
        this.reconnectTimeout = window.setTimeout(() => {
            this.reconnectTimeout = null
            this.closeSourceOnly()
            this.connect()
        }, delay)
    }

    private closeSourceOnly(): void {
        this.eventSource?.close()
        this.eventSource = null
    }

    disconnect(): void {
        this.disposed = true
        this.closeSourceOnly()
        if (this.reconnectTimeout != null) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }
    }
}
