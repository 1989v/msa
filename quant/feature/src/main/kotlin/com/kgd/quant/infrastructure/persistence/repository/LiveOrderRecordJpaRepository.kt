package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.LiveOrderRecordEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant
import java.util.UUID

interface LiveOrderRecordJpaRepository : JpaRepository<LiveOrderRecordEntity, UUID> {
    fun findFirstByTenantIdAndStrategyIdOrderByPlacedAtDesc(
        tenantId: UUID,
        strategyId: UUID,
    ): LiveOrderRecordEntity?

    fun findByStatusInAndPlacedAtBefore(
        statuses: Collection<String>,
        before: Instant,
    ): List<LiveOrderRecordEntity>
}
