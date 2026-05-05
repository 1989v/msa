package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEvent

/**
 * AuditEventRepositoryPort — `audit_event` chain access (ADR-0037 / TG-P3-31).
 */
interface AuditEventRepositoryPort {
    suspend fun append(event: AuditEvent)
    suspend fun lastTipHash(tenantId: TenantId): String?

    /** [tenantId] 의 events 를 id ASC 로 [limit] 만큼 — verify job 용. */
    suspend fun loadAscending(tenantId: TenantId, limit: Int): List<AuditEvent>
}
