package com.kgd.sevensplit.infrastructure.metrics

import com.kgd.sevensplit.infrastructure.persistence.repository.OutboxJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import jakarta.annotation.PostConstruct
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicLong

private val logger = KotlinLogging.logger {}

/**
 * TG-14.3: Outbox 테이블 미발행 행 수 gauge.
 *
 * ## 이름
 * `seven_split_outbox_pending_rows`
 *
 * ## 운영 의도
 * - Outbox relay 가 Kafka 발행에 실패하거나 지연될 때 pending row 가 쌓인다.
 * - Phase 1 에서는 임계치 알람을 문서(메트릭 노트)로만 정의한다. Phase 2 에서 Alertmanager 룰 편입.
 *
 * ## 구현
 * - Micrometer `Gauge.builder` 는 메트릭 스크레이프 시점에 `AtomicLong` 을 읽는다.
 * - [refresh] 는 Spring scheduler (`@Scheduled`) 가 아닌 스크레이프 직전 업데이트를
 *   위해 gauge 의 measurement function 내부에서 호출한다. 쿼리 비용이 부담되면
 *   Phase 2 에서 캐시 TTL 도입.
 */
@Component
class OutboxPendingMetric(
    private val registry: MeterRegistry,
    private val outboxRepository: OutboxJpaRepository,
) {
    private val pending = AtomicLong(0)

    @PostConstruct
    fun register() {
        Gauge.builder(SevenSplitMetrics.METRIC_OUTBOX_PENDING_ROWS, this) { it.currentPending() }
            .description("Outbox rows with published_at IS NULL")
            .register(registry)
    }

    /**
     * Gauge 측정 함수. 스크레이프 시점마다 count 쿼리 1 회.
     * 쿼리 실패 시 마지막 값을 유지 (Phase 1 단순화).
     */
    private fun currentPending(): Double {
        runCatching { outboxRepository.countByPublishedAtIsNull() }
            .onSuccess { pending.set(it) }
            .onFailure { e ->
                logger.debug { "OutboxPendingMetric count query failed: ${e.message}" }
            }
        return pending.get().toDouble()
    }
}
