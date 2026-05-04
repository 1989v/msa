package com.kgd.quant.domain.live

import com.kgd.quant.domain.common.TenantId
import java.math.BigDecimal
import java.time.Instant

/**
 * RiskLimit — 테넌트별 위험 한도 (ADR-0037 Phase 3).
 *
 * 일일 손실/거래량/단일 주문 최대 KRW. 매일 KST 00:00 누적 reset.
 * 임계 초과 시 [LiveTradingMode.Suspended] (자동 trigger).
 *
 * default 는 아주 보수적: 100k / 1M / 100k. 사용자 override 는 2FA 필수.
 */
data class RiskLimit(
    val tenantId: TenantId,
    val dailyLossLimitKrw: BigDecimal,
    val dailyVolumeLimitKrw: BigDecimal,
    val singleOrderMaxKrw: BigDecimal,
    val updatedAt: Instant,
    val updatedBy: Long,
) {
    init {
        require(dailyLossLimitKrw > BigDecimal.ZERO) {
            "dailyLossLimitKrw must be > 0 (got $dailyLossLimitKrw)"
        }
        require(dailyVolumeLimitKrw > BigDecimal.ZERO) {
            "dailyVolumeLimitKrw must be > 0 (got $dailyVolumeLimitKrw)"
        }
        require(singleOrderMaxKrw > BigDecimal.ZERO) {
            "singleOrderMaxKrw must be > 0 (got $singleOrderMaxKrw)"
        }
        require(singleOrderMaxKrw <= dailyVolumeLimitKrw) {
            "singleOrderMaxKrw($singleOrderMaxKrw) must be <= dailyVolumeLimitKrw($dailyVolumeLimitKrw)"
        }
    }

    fun lossBreached(currentDailyLoss: BigDecimal): Boolean =
        currentDailyLoss >= dailyLossLimitKrw

    fun volumeBreached(currentDailyVolume: BigDecimal): Boolean =
        currentDailyVolume >= dailyVolumeLimitKrw

    fun singleOrderExceeds(orderKrw: BigDecimal): Boolean =
        orderKrw > singleOrderMaxKrw

    companion object {
        fun default(tenantId: TenantId, updatedBy: Long, at: Instant): RiskLimit = RiskLimit(
            tenantId = tenantId,
            dailyLossLimitKrw = BigDecimal("100000"),
            dailyVolumeLimitKrw = BigDecimal("1000000"),
            singleOrderMaxKrw = BigDecimal("100000"),
            updatedAt = at,
            updatedBy = updatedBy,
        )
    }
}
