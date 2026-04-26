package com.kgd.quant.application.market

import com.kgd.quant.application.port.marketdata.Tick
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * TG-P2-07 / ADR-0025 — 시세 hot path SharedFlow 허브.
 *
 * ## 역할
 * - **primary**: in-process broadcast. `StrategyEngineLoop`, `PaperStreamSseController`,
 *   `NotificationPriorityQueue` 트리거 등 모든 hot path 소비자가 동일 JVM 안에서 [asFlow] 를 구독.
 * - **side-effect**: `MarketTickKafkaCollector` 가 별도 coroutine 으로 fan-out 한다 (옵셔널, default disabled).
 *
 * ## hot path 보호 (ADR-0025 §4.2 / OQ-P2-005)
 * - `replay = 0` — 신규 구독자는 과거 tick 을 재생받지 않는다 (백테스트 결정성과 분리).
 * - `extraBufferCapacity = 256` — 짧은 spike 흡수.
 * - `BufferOverflow.DROP_OLDEST` — 느린 소비자가 producer 를 차단하지 않게 가장 오래된 tick 을 drop.
 *
 * ## 트랜잭션 (ADR-0020)
 * 본 컴포넌트와 호출 경로(WS callback, REST poller) 모두 `@Transactional` 금지.
 * 시세 hot path 는 외부 IO + 비차단이며, DB 트랜잭션이 끼어들면 producer 차단 위험.
 */
@Component
class MarketDataHub(
    private val metrics: QuantMetrics,
) {
    private val flow = MutableSharedFlow<Tick>(
        replay = 0,
        extraBufferCapacity = EXTRA_BUFFER_CAPACITY,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    /** 다중 소비자가 동일 tick 을 동시 수신할 수 있는 read-only 핸들. */
    fun asFlow(): SharedFlow<Tick> = flow.asSharedFlow()

    /**
     * 비차단 발행. `tryEmit` 결과가 `false` 인 경우는 buffer 가 가득 찬 상태가 아니라
     * `DROP_OLDEST` 정책 + 0 subscribers 동시 발생 같은 edge 한정이지만, 안전을 위해
     * drop 카운터를 증가시킨다.
     *
     * @return `true` = 적어도 1개 subscriber 의 buffer 에 적재됨, `false` = drop 처리됨
     */
    fun emit(tick: Tick): Boolean {
        val accepted = flow.tryEmit(tick)
        if (!accepted) {
            metrics.marketHubDropped(REASON_BUFFER_OVERFLOW)
            log.trace { "MarketDataHub tick dropped symbol=${tick.symbol} source=${tick.source}" }
        }
        return accepted
    }

    /** 현재 활성 subscriber 수. SSE / Strategy Loop 등 hot path 모니터링용. */
    fun subscriberCount(): Int = flow.subscriptionCount.value

    companion object {
        const val EXTRA_BUFFER_CAPACITY = 256
        const val REASON_BUFFER_OVERFLOW = "buffer_overflow"
    }
}
