package com.kgd.ads.infrastructure.metrics

import com.kgd.ads.application.decision.port.DecisionMetricsPort
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.LocalDateTime
import java.util.concurrent.atomic.AtomicLong

/**
 * 광고 결정 메트릭.
 *
 * - `ads_decision_latency` (timer) — 서버 처리 시간. 목표 P99 ≤ 30ms
 * - `ads_decision_outcome_total` (counter) — 지면별 결과. `outcome` 은 `ad` 또는 없음 사유(`no_candidates` 등)·`crawler`
 * - `ads_index_refreshed_at_seconds` (gauge) — 마지막 인덱스 갱신 시각(epoch 초). 지금과의 차가 1분을 넘으면 갱신이 멈춘 것이다
 */
@Component
class DecisionMetrics(
    private val meterRegistry: MeterRegistry,
    @Qualifier("adsClock") private val clock: Clock,
) : DecisionMetricsPort {

    private val refreshedAtEpochSeconds = AtomicLong(0)
    private val latency: Timer = Timer.builder(LATENCY)
        .description("광고 결정 서버 처리 시간")
        .publishPercentiles(0.5, 0.99)
        .register(meterRegistry)

    init {
        Gauge.builder(INDEX_REFRESHED_AT, refreshedAtEpochSeconds) { it.get().toDouble() }
            .description("광고 후보 인덱스 마지막 갱신 시각 (epoch 초)")
            .register(meterRegistry)
    }

    override fun recordLatency(elapsed: Duration) = latency.record(elapsed)

    override fun recordOutcome(placement: String, outcome: String) {
        Counter.builder(OUTCOME)
            .description("광고 결정 지면별 결과")
            .tag("placement", placement)
            .tag("outcome", outcome)
            .register(meterRegistry)
            .increment()
    }

    override fun recordIndexRefreshed(at: LocalDateTime) {
        refreshedAtEpochSeconds.set(at.atZone(clock.zone).toEpochSecond())
    }

    companion object {
        const val LATENCY = "ads_decision_latency"
        const val OUTCOME = "ads_decision_outcome_total"
        const val INDEX_REFRESHED_AT = "ads_index_refreshed_at_seconds"
    }
}
