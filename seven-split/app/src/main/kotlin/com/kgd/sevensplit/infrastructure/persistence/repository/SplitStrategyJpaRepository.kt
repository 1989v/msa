package com.kgd.sevensplit.infrastructure.persistence.repository

import com.kgd.sevensplit.infrastructure.persistence.entity.SplitStrategyEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

/**
 * TG-08.3: `split_strategy` JpaRepository.
 *
 * 모든 조회는 `(id, tenantId)` 또는 `tenantId` 필수 — INV-05 를 Repository 계약에서 강제.
 */
interface SplitStrategyJpaRepository : JpaRepository<SplitStrategyEntity, UUID> {
    fun findByStrategyIdAndTenantId(strategyId: UUID, tenantId: String): SplitStrategyEntity?
    fun findAllByTenantId(tenantId: String): List<SplitStrategyEntity>
}
