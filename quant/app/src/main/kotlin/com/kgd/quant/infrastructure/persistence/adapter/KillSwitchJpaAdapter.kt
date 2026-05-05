package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.KillSwitchRepositoryPort
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.KillSwitch
import com.kgd.quant.infrastructure.persistence.adapter.RiskLimitJpaAdapter.Companion.toUuid
import com.kgd.quant.infrastructure.persistence.entity.KillSwitchLogEntity
import com.kgd.quant.infrastructure.persistence.repository.KillSwitchLogJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component

/**
 * TG-P3-13 — KillSwitch append-only JPA 어댑터 (ADR-0037).
 */
@Component
class KillSwitchJpaAdapter(
    private val repo: KillSwitchLogJpaRepository,
) : KillSwitchRepositoryPort {

    override suspend fun append(event: KillSwitch) = withContext(Dispatchers.IO) {
        val entity = KillSwitchLogEntity(
            scope = scopeOf(event),
            targetId = targetOf(event),
            enabled = event.enabled,
            reason = event.reason,
            actorId = event.actorId,
            occurredAt = event.toggledAt,
        )
        repo.save(entity)
        Unit
    }

    override suspend fun lastGlobal(): KillSwitch.Global? = withContext(Dispatchers.IO) {
        repo.findFirstByScopeAndTargetIdIsNullOrderByOccurredAtDesc(SCOPE_GLOBAL)?.let {
            KillSwitch.Global(it.enabled, it.occurredAt, it.actorId, it.reason)
        }
    }

    override suspend fun lastTenant(tenantId: TenantId): KillSwitch.Tenant? = withContext(Dispatchers.IO) {
        repo.findFirstByScopeAndTargetIdOrderByOccurredAtDesc(SCOPE_TENANT, tenantId.toUuid())?.let {
            KillSwitch.Tenant(tenantId, it.enabled, it.occurredAt, it.actorId, it.reason)
        }
    }

    override suspend fun lastStrategy(strategyId: StrategyId): KillSwitch.Strategy? = withContext(Dispatchers.IO) {
        repo.findFirstByScopeAndTargetIdOrderByOccurredAtDesc(SCOPE_STRATEGY, strategyId.value)?.let {
            KillSwitch.Strategy(strategyId, it.enabled, it.occurredAt, it.actorId, it.reason)
        }
    }

    private fun scopeOf(event: KillSwitch): String = when (event) {
        is KillSwitch.Global -> SCOPE_GLOBAL
        is KillSwitch.Tenant -> SCOPE_TENANT
        is KillSwitch.Strategy -> SCOPE_STRATEGY
    }

    private fun targetOf(event: KillSwitch) = when (event) {
        is KillSwitch.Global -> null
        is KillSwitch.Tenant -> event.tenantId.toUuid()
        is KillSwitch.Strategy -> event.strategyId.value
    }

    companion object {
        const val SCOPE_GLOBAL = "GLOBAL"
        const val SCOPE_TENANT = "TENANT"
        const val SCOPE_STRATEGY = "STRATEGY"
    }
}
