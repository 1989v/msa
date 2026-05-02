package com.kgd.common.messaging.outbox

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry

/**
 * Micrometer metric facade for the outbox publisher.
 *
 * Exposed metrics:
 * - `outbox_pending_count` (gauge) — polling 시점의 PENDING row 수. 누적 시 publisher / consumer 장애 의심.
 * - `outbox_publish_total` (counter) — 발행 성공 누적 (성공 ack 단위).
 * - `outbox_publish_error_total` (counter) — 발행 실패 누적 (예외 + Kafka future 실패 모두 포함).
 *
 * MeterRegistry 가 classpath 에 없을 경우를 대비해 [KgdMessagingOutboxAutoConfiguration] 에서
 * `@ConditionalOnClass(MeterRegistry::class)` 로 가드. 미등록 환경에서는 [OutboxMetrics.NOOP] 사용.
 */
class OutboxMetrics private constructor(
    private val publishSuccess: Counter?,
    private val publishError: Counter?,
) {

    fun incrementPublishSuccess() {
        publishSuccess?.increment()
    }

    fun incrementPublishError() {
        publishError?.increment()
    }

    companion object {
        val NOOP: OutboxMetrics = OutboxMetrics(publishSuccess = null, publishError = null)

        fun create(meterRegistry: MeterRegistry): OutboxMetrics = OutboxMetrics(
            publishSuccess = Counter.builder("outbox_publish_total")
                .description("Total number of outbox events successfully published to the broker")
                .register(meterRegistry),
            publishError = Counter.builder("outbox_publish_error_total")
                .description("Total number of outbox event publish failures")
                .register(meterRegistry),
        )
    }
}
