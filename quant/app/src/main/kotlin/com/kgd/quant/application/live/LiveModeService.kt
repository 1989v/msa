package com.kgd.quant.application.live

import com.kgd.quant.application.port.persistence.LiveModeRepositoryPort
import com.kgd.quant.application.port.security.TwoFactorTokenStorePort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.domain.live.LiveTradingMode
import com.kgd.quant.domain.live.SuspendReason
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * LiveModeService — 사용자별 live-trading 활성/비활성/일시정지 상태 관리 (ADR-0037 / TG-P3-04).
 *
 * - 활성/해제 토글 시 2FA 토큰 redeem 필수
 * - 자동 trigger (RiskLimit / ReconcileJob / AuditChain) 는 [suspend] 직접 호출
 * - 모든 변경은 AuditChain 에 기록
 */
@Service
class LiveModeService(
    private val repo: LiveModeRepositoryPort,
    private val tokenStore: TwoFactorTokenStorePort,
    private val auditChain: AuditChainService,
) {
    suspend fun current(tenantId: TenantId): LiveTradingMode = repo.findByTenantId(tenantId)

    suspend fun enable(tenantId: TenantId, userId: Long, twoFaTokenHash: String): ToggleResult {
        if (!tokenStore.redeem(userId, twoFaTokenHash)) {
            return ToggleResult.TwoFaRequired
        }
        val now = Instant.now()
        val state = LiveTradingMode.Enabled(tenantId, now, twoFaTokenHash)
        repo.save(state)
        auditChain.append(
            tenantId,
            AuditEventType.LIVE_MODE_TOGGLE,
            mapOf("to" to "ENABLED", "userId" to userId),
            now,
        )
        log.info { "live-mode ENABLED tenant=${tenantId.value} userId=$userId" }
        return ToggleResult.Ok(state)
    }

    suspend fun disable(tenantId: TenantId, userId: Long, twoFaTokenHash: String): ToggleResult {
        if (!tokenStore.redeem(userId, twoFaTokenHash)) {
            return ToggleResult.TwoFaRequired
        }
        val now = Instant.now()
        val state = LiveTradingMode.Disabled(tenantId)
        repo.save(state)
        auditChain.append(
            tenantId,
            AuditEventType.LIVE_MODE_TOGGLE,
            mapOf("to" to "DISABLED", "userId" to userId),
            now,
        )
        log.info { "live-mode DISABLED tenant=${tenantId.value} userId=$userId" }
        return ToggleResult.Ok(state)
    }

    /**
     * 자동/수동 suspend — 2FA 미요구 (자동 trigger 또는 운영자 강제).
     */
    suspend fun suspend(tenantId: TenantId, reason: SuspendReason, by: Long?) {
        val now = Instant.now()
        val state = LiveTradingMode.Suspended(tenantId, reason, now)
        repo.save(state)
        auditChain.append(
            tenantId,
            AuditEventType.LIVE_MODE_TOGGLE,
            mapOf("to" to "SUSPENDED", "reason" to reason.name, "by" to (by ?: "system")),
            now,
        )
        log.warn { "live-mode SUSPENDED tenant=${tenantId.value} reason=$reason by=$by" }
    }

    sealed interface ToggleResult {
        data class Ok(val state: LiveTradingMode) : ToggleResult
        data object TwoFaRequired : ToggleResult
    }
}
