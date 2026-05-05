package com.kgd.quant.application.port.state

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.KillSwitchSnapshot

/**
 * KillSwitchStatePort — Redis 기반 저지연 kill-switch 상태 (ADR-0037 / TG-P3-13).
 *
 * 키 (예시):
 * - `quant:kill-switch:global` (1/0)
 * - `quant:kill-switch:tenant:{tenantId}`
 * - `quant:kill-switch:strategy:{strategyId}`
 *
 * 토글: `set` (Redis SET + MySQL append 와 함께 호출하는 [KillSwitchService] 책임).
 * 평가: `snapshot(tenantId, strategyId)` 한 번에 3개 키 read → ≤200ms reflect 보장.
 */
interface KillSwitchStatePort {
    suspend fun setGlobal(enabled: Boolean)
    suspend fun setTenant(tenantId: TenantId, enabled: Boolean)
    suspend fun setStrategy(strategyId: StrategyId, enabled: Boolean)

    suspend fun snapshot(tenantId: TenantId, strategyId: StrategyId): KillSwitchSnapshot
}
