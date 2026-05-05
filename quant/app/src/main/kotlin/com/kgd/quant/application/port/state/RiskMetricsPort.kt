package com.kgd.quant.application.port.state

import com.kgd.quant.domain.common.TenantId
import java.math.BigDecimal
import java.time.LocalDate

/**
 * RiskMetricsPort — Redis 일일 누적 metric (ADR-0037 / TG-P3-14).
 *
 * 키 형식: `quant:risk-metrics:{tenantId}:{yyyy-MM-dd}` Hash {loss, volume, count}.
 * TTL 25h (다음날 KST 00:00 reset 보장 + 약간의 여유).
 *
 * 모든 add 는 atomic increment (Redis HINCRBYFLOAT).
 */
interface RiskMetricsPort {
    suspend fun addLoss(tenantId: TenantId, date: LocalDate, lossKrw: BigDecimal)
    suspend fun addVolume(tenantId: TenantId, date: LocalDate, volumeKrw: BigDecimal)
    suspend fun incCount(tenantId: TenantId, date: LocalDate)

    suspend fun snapshot(tenantId: TenantId, date: LocalDate): DailyMetrics
}

data class DailyMetrics(
    val lossKrw: BigDecimal,
    val volumeKrw: BigDecimal,
    val orderCount: Long,
)
