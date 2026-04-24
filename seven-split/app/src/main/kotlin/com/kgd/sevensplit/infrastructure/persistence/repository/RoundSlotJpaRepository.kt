package com.kgd.sevensplit.infrastructure.persistence.repository

import com.kgd.sevensplit.infrastructure.persistence.entity.RoundSlotEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface RoundSlotJpaRepository : JpaRepository<RoundSlotEntity, UUID> {
    fun findAllByRunIdAndTenantIdOrderByRoundIndexAsc(
        runId: UUID,
        tenantId: String
    ): List<RoundSlotEntity>

    fun findByRunIdAndTenantIdAndRoundIndex(
        runId: UUID,
        tenantId: String,
        roundIndex: Int
    ): RoundSlotEntity?
}
