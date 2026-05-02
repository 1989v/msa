package com.kgd.common.messaging.outbox

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import java.util.concurrent.atomic.AtomicLong

/**
 * Micrometer metric facade for the outbox publisher.
 *
 * Exposed metrics:
 * - `outbox_pending_count` (gauge) — 가장 최근 polling 시점의 PENDING row 수. 누적 시 publisher / consumer 장애 의심.
 *   ADR-0032 Phase 3 — 알람 임계: warn @ >100 / 5m, page @ >1000 / 1m. `application` 태그(Micrometer
 *   global tag) 로 서비스별 분기 가능 (order-service / inventory-service / fulfillment-service / ...).
 * - `outbox_publish_total` (counter) — 발행 성공 누적 (성공 ack 단위).
 * - `outbox_publish_error_total` (counter) — 발행 실패 누적 (예외 + Kafka future 실패 모두 포함).
 *
 * MeterRegistry 가 classpath 에 없을 경우를 대비해 [KgdMessagingOutboxAutoConfiguration] 에서
 * `@ConditionalOnClass(MeterRegistry::class)` 로 가드. 미등록 환경에서는 [OutboxMetrics.NOOP] 사용.
 */
class OutboxMetrics private constructor(
    private val publishSuccess: Counter?,
    private val publishError: Counter?,
    private val pendingHolder: AtomicLong?,
) {

    fun incrementPublishSuccess() {
        publishSuccess?.increment()
    }

    fun incrementPublishError() {
        publishError?.increment()
    }

    /**
     * Records the latest PENDING row count observed by the polling publisher.
     * Updated on every poll so the gauge reflects the most recent snapshot
     * even when no events were processed.
     */
    fun recordPendingCount(count: Long) {
        pendingHolder?.set(count)
    }

    companion object {
        val NOOP: OutboxMetrics = OutboxMetrics(
            publishSuccess = null,
            publishError = null,
            pendingHolder = null,
        )

        fun create(meterRegistry: MeterRegistry): OutboxMetrics {
            val pendingHolder = AtomicLong(0)
            Gauge.builder("outbox_pending_count", pendingHolder) { it.get().toDouble() }
                .description("Outbox rows in PENDING status (not yet published to the broker)")
                .register(meterRegistry)

            return OutboxMetrics(
                publishSuccess = Counter.builder("outbox_publish_total")
                    .description("Total number of outbox events successfully published to the broker")
                    .register(meterRegistry),
                publishError = Counter.builder("outbox_publish_error_total")
                    .description("Total number of outbox event publish failures")
                    .register(meterRegistry),
                pendingHolder = pendingHolder,
            )
        }
    }
}
