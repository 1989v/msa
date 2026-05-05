package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.AuditEventEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface AuditEventJpaRepository : JpaRepository<AuditEventEntity, Long> {
    fun findFirstByTenantIdOrderByOccurredAtDescIdDesc(tenantId: UUID): AuditEventEntity?
    fun findByTenantIdOrderByIdAsc(tenantId: UUID, pageable: Pageable): List<AuditEventEntity>
}
