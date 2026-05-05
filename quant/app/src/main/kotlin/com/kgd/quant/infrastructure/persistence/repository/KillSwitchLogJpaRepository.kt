package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.KillSwitchLogEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface KillSwitchLogJpaRepository : JpaRepository<KillSwitchLogEntity, Long> {
    fun findFirstByScopeAndTargetIdIsNullOrderByOccurredAtDesc(scope: String): KillSwitchLogEntity?
    fun findFirstByScopeAndTargetIdOrderByOccurredAtDesc(scope: String, targetId: UUID): KillSwitchLogEntity?
}
