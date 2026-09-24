package com.kgd.payment.infrastructure.metrics

import com.kgd.common.ops.OpsGauges
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * 결제 운영 지표 — 주기마다 payment_db 를 센다.
 * - `commerce_payment_unknown` — 결과 미상(UNKNOWN) 결제 수. 재조회가 결론을 내면 줄어든다
 * - `commerce_reconciliation_mismatch` — 대사 불일치로 판정된 행 수(재시도하면 판정이 지워진다)
 */
@Component
class PaymentOpsMetrics(
    @Qualifier("paymentMasterDataSource") dataSource: DataSource,
    registry: MeterRegistry,
) {
    private val log = KotlinLogging.logger {}
    private val jdbc = JdbcTemplate(dataSource)
    private val gauges = OpsGauges(registry)

    @Scheduled(fixedDelayString = "\${commerce.ops.metrics-interval-ms:60000}", initialDelayString = "\${commerce.ops.metrics-initial-delay-ms:30000}")
    fun refresh() = runCatching {
        gauges.set(
            "commerce_payment_unknown",
            jdbc.queryForObject("SELECT COUNT(*) FROM payment WHERE status = 'UNKNOWN'", Long::class.java) ?: 0,
        )
        gauges.set(
            "commerce_reconciliation_mismatch",
            jdbc.queryForObject("SELECT COUNT(*) FROM payment_reconciliation WHERE result = 'MISMATCH'", Long::class.java) ?: 0,
        )
    }.onFailure { log.warn(it) { "결제 지표 갱신 실패" } }
}
