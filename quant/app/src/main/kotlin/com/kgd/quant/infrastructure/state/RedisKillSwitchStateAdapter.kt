package com.kgd.quant.infrastructure.state

import com.kgd.quant.application.port.state.KillSwitchStatePort
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.KillSwitchSnapshot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component

/**
 * TG-P3-13 — Redis 기반 저지연 KillSwitchState 어댑터 (ADR-0037).
 *
 * 키:
 * - global: `quant:kill-switch:global`  → "1" / "0"
 * - tenant: `quant:kill-switch:tenant:{tenantId}`
 * - strategy: `quant:kill-switch:strategy:{strategyId}`
 *
 * snapshot 은 single round-trip multiGet — ≤200ms 반영 보장 (Redis 단일 인스턴스 가정).
 */
@Component
class RedisKillSwitchStateAdapter(
    private val redis: StringRedisTemplate,
) : KillSwitchStatePort {

    override suspend fun setGlobal(enabled: Boolean) = withContext(Dispatchers.IO) {
        redis.opsForValue().set(KEY_GLOBAL, boolStr(enabled))
    }

    override suspend fun setTenant(tenantId: TenantId, enabled: Boolean) = withContext(Dispatchers.IO) {
        redis.opsForValue().set(tenantKey(tenantId), boolStr(enabled))
    }

    override suspend fun setStrategy(strategyId: StrategyId, enabled: Boolean) = withContext(Dispatchers.IO) {
        redis.opsForValue().set(strategyKey(strategyId), boolStr(enabled))
    }

    override suspend fun snapshot(tenantId: TenantId, strategyId: StrategyId): KillSwitchSnapshot =
        withContext(Dispatchers.IO) {
            val keys = listOf(KEY_GLOBAL, tenantKey(tenantId), strategyKey(strategyId))
            val values = redis.opsForValue().multiGet(keys) ?: List(keys.size) { null }
            KillSwitchSnapshot(
                global = values[0] == "1",
                tenant = values[1] == "1",
                strategy = values[2] == "1",
            )
        }

    private fun boolStr(b: Boolean) = if (b) "1" else "0"
    private fun tenantKey(tenantId: TenantId) = "quant:kill-switch:tenant:${tenantId.value}"
    private fun strategyKey(strategyId: StrategyId) = "quant:kill-switch:strategy:${strategyId.value}"

    companion object {
        const val KEY_GLOBAL = "quant:kill-switch:global"
    }
}
