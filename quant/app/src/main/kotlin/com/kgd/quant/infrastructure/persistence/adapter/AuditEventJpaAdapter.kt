package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.AuditEventRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEvent
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.infrastructure.persistence.adapter.RiskLimitJpaAdapter.Companion.toUuid
import com.kgd.quant.infrastructure.persistence.entity.AuditEventEntity
import com.kgd.quant.infrastructure.persistence.repository.AuditEventJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

/**
 * TG-P3-31 — AuditEvent JPA 어댑터 (chain, ADR-0037).
 */
@Component
class AuditEventJpaAdapter(
    private val repo: AuditEventJpaRepository,
) : AuditEventRepositoryPort {

    override suspend fun append(event: AuditEvent) = withContext(Dispatchers.IO) {
        val entity = AuditEventEntity(
            tenantId = event.tenantId.toUuid(),
            eventType = event.eventType.name,
            payloadJson = event.payloadCanonical,
            occurredAt = event.occurredAt,
            prevHash = event.prevHash,
            currentHash = event.currentHash,
        )
        repo.save(entity)
        Unit
    }

    override suspend fun lastTipHash(tenantId: TenantId): String? = withContext(Dispatchers.IO) {
        repo.findFirstByTenantIdOrderByOccurredAtDescIdDesc(tenantId.toUuid())?.currentHash
    }

    override suspend fun loadAscending(tenantId: TenantId, limit: Int): List<AuditEvent> =
        withContext(Dispatchers.IO) {
            repo.findByTenantIdOrderByIdAsc(tenantId.toUuid(), PageRequest.of(0, limit))
                .map { it.toDomain(tenantId) }
        }

    private fun AuditEventEntity.toDomain(tenantId: TenantId): AuditEvent = AuditEvent(
        tenantId = tenantId,
        eventType = AuditEventType.valueOf(eventType),
        payloadCanonical = payloadJson,
        occurredAt = occurredAt,
        prevHash = prevHash,
        currentHash = currentHash,
    )
}
