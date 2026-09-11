package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.SignalStrategyEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface SignalStrategyJpaRepository : JpaRepository<SignalStrategyEntity, UUID> {
    fun findByStrategyIdAndTenantId(strategyId: UUID, tenantId: String): SignalStrategyEntity?
    fun findAllByTenantIdOrderByCreatedAtDesc(tenantId: String): List<SignalStrategyEntity>
    fun deleteByStrategyIdAndTenantId(strategyId: UUID, tenantId: String): Long
}
