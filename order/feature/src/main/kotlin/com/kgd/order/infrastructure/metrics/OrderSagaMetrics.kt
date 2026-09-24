package com.kgd.order.infrastructure.metrics

import com.kgd.common.ops.OpsGauges
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.sql.Timestamp
import java.time.Clock
import javax.sql.DataSource

/**
 * 사가 운영 지표 — `order_saga` 를 주기마다 센다.
 * - `commerce_saga_active{status}` — RUNNING · COMPENSATING · STUCK 사가 수
 * - `commerce_saga_step_dwell_max_seconds` — 진행 중 사가가 지금 단계에 머문 가장 긴 시간(체류). 10분을 넘으면 운영 이슈가 열린다
 * - `commerce_saga_compensations` — 보상에 들어간 적 있는 사가 누계(실패 사유가 있는 행)
 */
@Component
class OrderSagaMetrics(
    @Qualifier("orderMasterDataSource") dataSource: DataSource,
    registry: MeterRegistry,
    @Qualifier("orderClock") private val clock: Clock,
) {
    private val log = KotlinLogging.logger {}
    private val jdbc = JdbcTemplate(dataSource)
    private val gauges = OpsGauges(registry)

    @Scheduled(fixedDelayString = "\${commerce.ops.metrics-interval-ms:60000}", initialDelayString = "\${commerce.ops.metrics-initial-delay-ms:30000}")
    fun refresh() = runCatching {
        val byStatus = jdbc.queryForList(
            "SELECT status, COUNT(*) AS c FROM order_saga WHERE status IN ('RUNNING', 'COMPENSATING', 'STUCK') GROUP BY status",
        ).associate { it["status"] as String to (it["c"] as Number).toLong() }
        listOf("RUNNING", "COMPENSATING", "STUCK").forEach { gauges.set("commerce_saga_active", byStatus[it] ?: 0, "status" to it) }

        val oldest = jdbc.queryForObject(
            "SELECT MIN(COALESCE(step_entered_at, started_at)) FROM order_saga WHERE status IN ('RUNNING', 'COMPENSATING')",
            Timestamp::class.java,
        )
        gauges.set("commerce_saga_step_dwell_max_seconds", oldest?.let { (clock.millis() - it.time).coerceAtLeast(0) / 1000 } ?: 0)
        gauges.set(
            "commerce_saga_compensations",
            jdbc.queryForObject("SELECT COUNT(*) FROM order_saga WHERE failure_reason IS NOT NULL", Long::class.java) ?: 0,
        )
    }.onFailure { log.warn(it) { "사가 지표 갱신 실패" } }
}
