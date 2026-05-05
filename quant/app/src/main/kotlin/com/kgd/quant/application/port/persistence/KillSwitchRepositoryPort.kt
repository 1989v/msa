package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.KillSwitch

/**
 * KillSwitchRepositoryPort — `kill_switch_log` append-only audit port (ADR-0037 / TG-P3-13).
 *
 * 인프라 구현은 MySQL append-only INSERT. 조회는 마지막 enabled 상태를 위해 ORDER BY occurred_at DESC LIMIT 1.
 * Redis (저지연 read) 는 별도 [KillSwitchStatePort] 가 담당.
 */
interface KillSwitchRepositoryPort {
    suspend fun append(event: KillSwitch)

    suspend fun lastGlobal(): KillSwitch.Global?
    suspend fun lastTenant(tenantId: TenantId): KillSwitch.Tenant?
    suspend fun lastStrategy(strategyId: StrategyId): KillSwitch.Strategy?
}
