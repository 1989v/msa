package com.kgd.quant.application.audit.service

import com.kgd.quant.domain.live.AuditEvent
import com.kgd.quant.application.audit.port.AuditEventRepositoryPort
import com.kgd.quant.application.audit.usecase.ListAuditEventsUseCase
import com.kgd.quant.domain.common.TenantId
import org.springframework.stereotype.Service

/** 조회 한도는 여기서 접는다 — 컨트롤러가 넘긴 값으로 원장을 통째로 훑지 않도록. */
@Service
class ListAuditEventsService(
    private val auditRepository: AuditEventRepositoryPort,
) : ListAuditEventsUseCase {

    override suspend fun execute(tenantId: TenantId, limit: Int): List<AuditEvent> =
        auditRepository.loadAscending(tenantId, limit.coerceIn(1, MAX_ROWS))

    private companion object { const val MAX_ROWS = 1000 }
}
