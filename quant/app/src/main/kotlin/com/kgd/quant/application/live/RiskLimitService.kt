package com.kgd.quant.application.live

import com.kgd.quant.application.port.persistence.RiskLimitRepositoryPort
import com.kgd.quant.application.port.state.DailyMetrics
import com.kgd.quant.application.port.state.RiskMetricsPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.RiskLimit
import com.kgd.quant.domain.live.SuspendReason
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

private val log = KotlinLogging.logger {}

/**
 * RiskLimitService — 사용자별 위험 한도 + 자동 trigger 평가 (ADR-0037 / TG-P3-14 ~ TG-P3-15).
 *
 * 책임:
 * - 한도 조회 / 갱신 (override 시 외부 2FA 토큰 redeem 은 호출자 책임)
 * - 일일 누적 metric 조회 (Redis port)
 * - 단일 주문 사전 평가 — 7단계 게이트 일부 (`evaluatePreOrder`)
 * - 사후 누적 — 자동 trigger 평가 (`recordOrderAndCheck`)
 *
 * 자동 suspend 발동 조건은 [SuspendReason] 으로 반환. 호출자 ([KillSwitchService]) 가 토글 수행.
 */
@Service
class RiskLimitService(
    private val repo: RiskLimitRepositoryPort,
    private val metrics: RiskMetricsPort,
    private val clock: Clock = Clock.system(ZoneId.of("Asia/Seoul")),
) {
    suspend fun limitOrDefault(tenantId: TenantId, defaultUserId: Long, at: Instant): RiskLimit {
        val existing = repo.findByTenantId(tenantId)
        if (existing != null) return existing
        val default = RiskLimit.default(tenantId, defaultUserId, at)
        repo.save(default)
        return default
    }

    suspend fun update(limit: RiskLimit) = repo.save(limit)

    /**
     * 단일 주문 placement 직전 평가 — 사전 게이트.
     * 차단되면 PreOrderResult.Reject 반환. 통과 시 Allow.
     */
    suspend fun evaluatePreOrder(
        tenantId: TenantId,
        orderKrw: BigDecimal,
    ): PreOrderResult {
        val limit = repo.findByTenantId(tenantId)
            ?: return PreOrderResult.Reject(SuspendReason.DAILY_VOLUME_LIMIT, "RiskLimit not configured")
        if (limit.singleOrderExceeds(orderKrw)) {
            return PreOrderResult.Reject(SuspendReason.DAILY_VOLUME_LIMIT, "single-order-max breach")
        }
        val today = LocalDate.now(clock)
        val now = metrics.snapshot(tenantId, today)
        if (limit.lossBreached(now.lossKrw)) {
            return PreOrderResult.Reject(SuspendReason.DAILY_LOSS_LIMIT, "daily-loss-limit breach")
        }
        if (limit.volumeBreached(now.volumeKrw.add(orderKrw))) {
            return PreOrderResult.Reject(SuspendReason.DAILY_VOLUME_LIMIT, "daily-volume-limit breach")
        }
        return PreOrderResult.Allow(limit, now)
    }

    /**
     * 주문 체결 후 누적 + 자동 trigger 평가.
     * pnlKrw 는 음수면 손실, 양수면 이익 (음수만 누적).
     */
    suspend fun recordOrderAndCheck(
        tenantId: TenantId,
        orderKrw: BigDecimal,
        pnlKrw: BigDecimal,
    ): SuspendReason? {
        val today = LocalDate.now(clock)
        metrics.addVolume(tenantId, today, orderKrw)
        metrics.incCount(tenantId, today)
        if (pnlKrw < BigDecimal.ZERO) {
            metrics.addLoss(tenantId, today, pnlKrw.negate())
        }
        val limit = repo.findByTenantId(tenantId) ?: return null
        val now = metrics.snapshot(tenantId, today)
        return when {
            limit.lossBreached(now.lossKrw) -> {
                log.warn { "tenant $tenantId DAILY_LOSS_LIMIT 초과 (loss=${now.lossKrw} >= ${limit.dailyLossLimitKrw})" }
                SuspendReason.DAILY_LOSS_LIMIT
            }
            limit.volumeBreached(now.volumeKrw) -> {
                log.warn { "tenant $tenantId DAILY_VOLUME_LIMIT 초과 (volume=${now.volumeKrw} >= ${limit.dailyVolumeLimitKrw})" }
                SuspendReason.DAILY_VOLUME_LIMIT
            }
            else -> null
        }
    }

    sealed interface PreOrderResult {
        data class Allow(val limit: RiskLimit, val current: DailyMetrics) : PreOrderResult
        data class Reject(val reason: SuspendReason, val detail: String) : PreOrderResult
    }
}
