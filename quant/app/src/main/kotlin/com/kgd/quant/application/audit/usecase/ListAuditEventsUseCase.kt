package com.kgd.quant.application.audit.usecase

import com.kgd.quant.domain.live.AuditEvent
import com.kgd.quant.domain.common.TenantId

/** 감사 로그 조회 — 체인 검증 순서대로 오름차순 (ADR-0037). */
interface ListAuditEventsUseCase {
    suspend fun execute(tenantId: TenantId, limit: Int): List<AuditEvent>
}
