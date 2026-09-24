package com.kgd.ads.infrastructure.metrics

import com.kgd.ads.application.settlement.port.SettlementMetricsPort
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.LocalDateTime
import java.util.concurrent.atomic.AtomicLong

/**
 * 집계·정산·원장 메트릭.
 *
 * - `ads_aggregation_completed_at_seconds` (gauge) — 마지막으로 모든 시각을 실패 없이 반영한 시각(epoch 초)
 * - `ads_settlement_completed_at_seconds` (gauge) — 마지막으로 정산을 실패 없이 끝낸 시각(epoch 초).
 *   지금과의 차가 커지면 결정이 미정산 6시간 한도에 걸려 유료 광고가 멈춘다
 * - `ads_ledger_imbalance_micros` (gauge) — 마지막 원장 검사의 전체 분개 합. 0 이 아니면 불균형
 */
@Component
class SettlementMetrics(
    meterRegistry: MeterRegistry,
    @Qualifier("adsClock") private val clock: Clock,
) : SettlementMetricsPort {

    private val aggregatedAt = AtomicLong(0)
    private val settledAt = AtomicLong(0)
    private val ledgerImbalance = AtomicLong(0)

    init {
        Gauge.builder(AGGREGATED_AT, aggregatedAt) { it.get().toDouble() }
            .description("광고 시간별 집계 마지막 성공 시각 (epoch 초)")
            .register(meterRegistry)
        Gauge.builder(SETTLED_AT, settledAt) { it.get().toDouble() }
            .description("광고 정산 마지막 성공 시각 (epoch 초)")
            .register(meterRegistry)
        Gauge.builder(LEDGER_IMBALANCE, ledgerImbalance) { it.get().toDouble() }
            .description("광고 원장 전체 분개 합 (0 이 정상)")
            .register(meterRegistry)
    }

    override fun recordAggregated(at: LocalDateTime) = aggregatedAt.set(epochSeconds(at))

    override fun recordSettled(at: LocalDateTime) = settledAt.set(epochSeconds(at))

    override fun recordLedgerImbalance(imbalanceMicros: Long) = ledgerImbalance.set(imbalanceMicros)

    private fun epochSeconds(at: LocalDateTime): Long = at.atZone(clock.zone).toEpochSecond()

    companion object {
        const val AGGREGATED_AT = "ads_aggregation_completed_at_seconds"
        const val SETTLED_AT = "ads_settlement_completed_at_seconds"
        const val LEDGER_IMBALANCE = "ads_ledger_imbalance_micros"
    }
}
