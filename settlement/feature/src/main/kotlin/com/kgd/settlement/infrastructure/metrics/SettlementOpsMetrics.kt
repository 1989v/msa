package com.kgd.settlement.infrastructure.metrics

import com.kgd.common.ops.OpsGauges
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * 정산 운영 지표 — `commerce_settlement_payout_won{status}` : 정산서 지급액 합(원). PAID 는 지급 누계,
 * CONFIRMED 는 지급 대기(송금 실패로 남은 것 포함)
 */
@Component
class SettlementOpsMetrics(
    @Qualifier("settlementMasterDataSource") dataSource: DataSource,
    registry: MeterRegistry,
) {
    private val log = KotlinLogging.logger {}
    private val jdbc = JdbcTemplate(dataSource)
    private val gauges = OpsGauges(registry)

    @Scheduled(fixedDelayString = "\${commerce.ops.metrics-interval-ms:60000}", initialDelayString = "\${commerce.ops.metrics-initial-delay-ms:30000}")
    fun refresh() = runCatching {
        val sums = jdbc.queryForList(
            "SELECT status, COALESCE(SUM(payout), 0) AS s FROM settlement_statement WHERE status IN ('PAID', 'CONFIRMED') GROUP BY status",
        ).associate { it["status"] as String to (it["s"] as Number).toLong() }
        listOf("PAID", "CONFIRMED").forEach { gauges.set("commerce_settlement_payout_won", sums[it] ?: 0, "status" to it) }
    }.onFailure { log.warn(it) { "정산 지표 갱신 실패" } }
}
