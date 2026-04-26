package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.TrancheSlotEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TrancheSlotJpaRepository : JpaRepository<TrancheSlotEntity, UUID> {
    fun findAllByRunIdAndTenantIdOrderByRoundIndexAsc(
        runId: UUID,
        tenantId: String
    ): List<TrancheSlotEntity>

    fun findByRunIdAndTenantIdAndRoundIndex(
        runId: UUID,
        tenantId: String,
        roundIndex: Int
    ): TrancheSlotEntity?
}
