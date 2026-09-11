package com.kgd.quant.application.live.usecase

import com.kgd.quant.application.live.port.LiveModeRepositoryPort
import com.kgd.quant.application.security.port.TwoFactorTokenStorePort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.domain.live.LiveTradingMode
import com.kgd.quant.domain.live.SuspendReason
import io.github.oshai.kotlinlogging.KotlinLogging
import java.time.Instant

/** 실매매 모드 토글·조회. 2FA 통과가 전제다 (ADR-0037 4-layer gate). */
interface ManageLiveModeUseCase {
    suspend fun current(tenantId: TenantId): LiveTradingMode
    suspend fun enable(tenantId: TenantId, userId: Long, twoFaTokenHash: String): ToggleResult
    suspend fun disable(tenantId: TenantId, userId: Long, twoFaTokenHash: String): ToggleResult
    suspend fun suspend(tenantId: TenantId, reason: SuspendReason, by: Long?)

    sealed interface ToggleResult {
        data class Ok(val state: LiveTradingMode) : ToggleResult
        data object TwoFaRequired : ToggleResult
    }
}
