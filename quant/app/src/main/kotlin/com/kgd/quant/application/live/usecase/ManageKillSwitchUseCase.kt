package com.kgd.quant.application.live.usecase

import com.kgd.quant.application.live.port.KillSwitchRepositoryPort
import com.kgd.quant.application.live.port.KillSwitchStatePort
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.KillSwitch
import com.kgd.quant.domain.live.KillSwitchSnapshot
import io.github.oshai.kotlinlogging.KotlinLogging
import java.time.Instant

/** 3-레벨 KillSwitch 토글·스냅샷 (전역/테넌트/전략). */
interface ManageKillSwitchUseCase {
    suspend fun toggleGlobal(
        enabled: Boolean,
        actorId: Long,
        reason: String?,
        at: Instant = Instant.now(),
    )
    suspend fun toggleTenant(
        tenantId: TenantId,
        enabled: Boolean,
        actorId: Long,
        reason: String?,
        at: Instant = Instant.now(),
    )
    suspend fun toggleStrategy(
        strategyId: StrategyId,
        enabled: Boolean,
        actorId: Long,
        reason: String?,
        at: Instant = Instant.now(),
    )
    suspend fun snapshot(tenantId: TenantId, strategyId: StrategyId): KillSwitchSnapshot
}
