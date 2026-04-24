package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.StrategyRunEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface StrategyRunJpaRepository : JpaRepository<StrategyRunEntity, UUID> {
    fun findByRunIdAndTenantId(runId: UUID, tenantId: String): StrategyRunEntity?
    fun findAllByStrategyIdAndTenantIdOrderByStartedAtDesc(
        strategyId: UUID,
        tenantId: String
    ): List<StrategyRunEntity>
}
