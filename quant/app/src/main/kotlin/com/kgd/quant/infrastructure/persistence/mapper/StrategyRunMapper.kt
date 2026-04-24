package com.kgd.quant.infrastructure.persistence.mapper

import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.EndReason
import com.kgd.quant.domain.strategy.StrategyRun
import com.kgd.quant.domain.strategy.StrategyRunStatus
import com.kgd.quant.infrastructure.persistence.entity.StrategyRunEntity

/**
 * TG-08.4: `StrategyRun` ↔ `StrategyRunEntity` 변환.
 */
object StrategyRunMapper {

    fun toEntity(domain: StrategyRun): StrategyRunEntity = StrategyRunEntity(
        runId = domain.id.value,
        strategyId = domain.strategyId.value,
        tenantId = domain.tenantId.value,
        executionMode = domain.executionMode.name,
        seed = domain.seed,
        status = domain.status.name,
        endReason = domain.endReason?.name,
        startedAt = domain.startedAt,
        endedAt = domain.endedAt
    )

    fun applyToEntity(entity: StrategyRunEntity, domain: StrategyRun): StrategyRunEntity {
        entity.strategyId = domain.strategyId.value
        entity.tenantId = domain.tenantId.value
        entity.executionMode = domain.executionMode.name
        entity.seed = domain.seed
        entity.status = domain.status.name
        entity.endReason = domain.endReason?.name
        entity.startedAt = domain.startedAt
        entity.endedAt = domain.endedAt
        return entity
    }

    fun toDomain(entity: StrategyRunEntity): StrategyRun = StrategyRun.reconstruct(
        id = RunId(entity.runId),
        strategyId = StrategyId(entity.strategyId),
        tenantId = TenantId(entity.tenantId),
        startedAt = entity.startedAt,
        endedAt = entity.endedAt,
        executionMode = ExecutionMode.valueOf(entity.executionMode),
        seed = entity.seed,
        endReason = entity.endReason?.let { EndReason.valueOf(it) },
        status = StrategyRunStatus.valueOf(entity.status)
    )
}
