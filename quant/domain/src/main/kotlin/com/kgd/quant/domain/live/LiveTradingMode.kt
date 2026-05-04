package com.kgd.quant.domain.live

import com.kgd.quant.domain.common.TenantId
import java.time.Instant

/**
 * LiveTradingMode — 테넌트별 실매매 활성 상태 sealed (ADR-0037 Phase 3).
 *
 * 상태 전이:
 * - Disabled → Enabled : 사용자가 2FA 검증 후 토글
 * - Enabled → Suspended : 자동 trigger (limit/drift) 또는 사용자/Admin kill-switch
 * - Suspended → Enabled : 사용자가 2FA 검증 후 명시 해제
 * - Enabled → Disabled / Suspended → Disabled : 사용자가 영구 비활성화
 */
sealed interface LiveTradingMode {
    val tenantId: TenantId

    data class Disabled(
        override val tenantId: TenantId,
    ) : LiveTradingMode

    data class Enabled(
        override val tenantId: TenantId,
        val activatedAt: Instant,
        val twoFaTokenHash: String,
    ) : LiveTradingMode {
        init {
            require(twoFaTokenHash.length == 64) {
                "twoFaTokenHash must be SHA-256 hex (64 chars), got ${twoFaTokenHash.length}"
            }
        }
    }

    data class Suspended(
        override val tenantId: TenantId,
        val reason: SuspendReason,
        val suspendedAt: Instant,
    ) : LiveTradingMode
}

enum class SuspendReason {
    USER_KILL_SWITCH,
    GLOBAL_KILL_SWITCH,
    DAILY_LOSS_LIMIT,
    DAILY_VOLUME_LIMIT,
    RECONCILE_DRIFT,
    EXCHANGE_REJECTION_BURST,
}
