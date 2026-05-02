package com.kgd.common.messaging

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import java.util.concurrent.ConcurrentHashMap

/**
 * ADR-0029 §Decision §7 — 멱등 처리 결과 메트릭.
 *
 * ## Counters
 * - `kgd_idempotent_processed_total{consumer_group, result}` — result ∈ {processed, skipped, race, error}
 * - `kgd_idempotent_event_missing_id_total{consumer_group}` — eventId 누락으로 graceful degrade 한 빈도
 *
 * 호환성 alias (Plan §3.1.1):
 * - `idempotent_event_processed_total`
 * - `idempotent_event_skip_total`
 * - `idempotent_event_error_total`
 */
class IdempotentMetrics(
    private val meterRegistry: MeterRegistry,
) {

    private val processedCache = ConcurrentHashMap<Pair<String, Result>, Counter>()
    private val missingCache = ConcurrentHashMap<String, Counter>()

    fun processed(consumerGroup: String) = increment(consumerGroup, Result.PROCESSED)

    fun skipped(consumerGroup: String) = increment(consumerGroup, Result.SKIPPED)

    fun race(consumerGroup: String) = increment(consumerGroup, Result.RACE)

    fun error(consumerGroup: String) = increment(consumerGroup, Result.ERROR)

    fun missingId(consumerGroup: String) {
        missingCache.computeIfAbsent(consumerGroup) {
            Counter.builder(MISSING_METRIC_NAME)
                .tag("consumer_group", consumerGroup)
                .description("Number of consumer events missing eventId (graceful degrade)")
                .register(meterRegistry)
        }.increment()
    }

    private fun increment(consumerGroup: String, result: Result) {
        processedCache.computeIfAbsent(consumerGroup to result) {
            Counter.builder(PROCESSED_METRIC_NAME)
                .tag("consumer_group", consumerGroup)
                .tag("result", result.tag)
                .description("Idempotent consumer processing outcomes")
                .register(meterRegistry)
        }.increment()
    }

    enum class Result(val tag: String) {
        PROCESSED("processed"),
        SKIPPED("skipped"),
        RACE("race"),
        ERROR("error"),
    }

    companion object {
        const val PROCESSED_METRIC_NAME = "kgd_idempotent_processed_total"
        const val MISSING_METRIC_NAME = "kgd_idempotent_event_missing_id_total"
    }
}
