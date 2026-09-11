package com.kgd.quant.application.live.usecase

import com.kgd.quant.application.live.port.DailyMetrics
import com.kgd.quant.application.live.port.RiskLimitRepositoryPort
import com.kgd.quant.application.live.port.RiskMetricsPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.RiskLimit
import com.kgd.quant.domain.live.SuspendReason
import io.github.oshai.kotlinlogging.KotlinLogging
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** 리스크 한도 조회·수정 + 주문 전/후 평가. */
interface ManageRiskLimitUseCase {
    suspend fun limitOrDefault(tenantId: TenantId, defaultUserId: Long, at: Instant): RiskLimit
    suspend fun update(limit: RiskLimit)
    suspend fun evaluatePreOrder(
        tenantId: TenantId,
        orderKrw: BigDecimal,
    ): PreOrderResult
    suspend fun recordOrderAndCheck(
        tenantId: TenantId,
        orderKrw: BigDecimal,
        pnlKrw: BigDecimal,
    ): SuspendReason?

    sealed interface PreOrderResult {
        data class Allow(val limit: RiskLimit, val current: DailyMetrics) : PreOrderResult
        data class Reject(val reason: SuspendReason, val detail: String) : PreOrderResult
    }
}
