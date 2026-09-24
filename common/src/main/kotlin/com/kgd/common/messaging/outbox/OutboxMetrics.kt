package com.kgd.common.messaging.outbox

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Micrometer metric facade for the outbox publisher.
 *
 * Exposed metrics:
 * - `outbox_pending_count{outbox}` (gauge) — 아직 발행 안 된 행(PENDING + SENDING). 한 JVM 에 릴레이가 여럿이라
 *   (commerce 폴드) `outbox` 태그로 스키마를 가른다. 누적 시 publisher / broker 장애 의심.
 *   ADR-0032 Phase 3 — 알람 임계: warn @ >100 / 5m, page @ >1000 / 1m.
 * - `outbox_failed_count{outbox}` (gauge) — 재시도 한도를 넘겨 멈춘 FAILED 행. 0 이 아니면 사람이 봐야 한다.
 * - `outbox_publish_total` (counter) — 발행 성공 누적 (성공 ack 단위).
 * - `outbox_publish_error_total` (counter) — 발행 실패 누적 (예외 + Kafka future 실패 모두 포함).
 *
 * MeterRegistry 가 classpath 에 없을 경우를 대비해 [KgdMessagingOutboxAutoConfiguration] 에서
 * `@ConditionalOnClass(MeterRegistry::class)` 로 가드. 미등록 환경에서는 [OutboxMetrics.NOOP] 사용.
 */
class OutboxMetrics private constructor(
    private val meterRegistry: MeterRegistry?,
    private val publishSuccess: Counter?,
    private val publishError: Counter?,
) {
    private val gauges = ConcurrentHashMap<Pair<String, String>, AtomicLong>()

    fun incrementPublishSuccess() {
        publishSuccess?.increment()
    }

    fun incrementPublishError() {
        publishError?.increment()
    }

    /** 폴링마다 갱신한다 — 빈 폴링에서도 0 으로 떨어져야 적체 해소가 보인다. */
    fun recordBacklog(outbox: String, backlog: Long, failed: Long) {
        gauge("outbox_pending_count", outbox)?.set(backlog)
        gauge("outbox_failed_count", outbox)?.set(failed)
    }

    private fun gauge(name: String, outbox: String): AtomicLong? {
        val registry = meterRegistry ?: return null
        return gauges.computeIfAbsent(name to outbox) {
            AtomicLong(0).also { holder ->
                Gauge.builder(name, holder) { it.get().toDouble() }
                    .tag("outbox", outbox)
                    .register(registry)
            }
        }
    }

    companion object {
        val NOOP: OutboxMetrics = OutboxMetrics(meterRegistry = null, publishSuccess = null, publishError = null)

        fun create(meterRegistry: MeterRegistry): OutboxMetrics = OutboxMetrics(
            meterRegistry = meterRegistry,
            publishSuccess = Counter.builder("outbox_publish_total")
                .description("Total number of outbox events successfully published to the broker")
                .register(meterRegistry),
            publishError = Counter.builder("outbox_publish_error_total")
                .description("Total number of outbox event publish failures")
                .register(meterRegistry),
        )
    }
}
