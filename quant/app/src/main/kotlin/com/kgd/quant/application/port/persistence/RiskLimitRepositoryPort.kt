package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.RiskLimit

/**
 * RiskLimitRepositoryPort — `risk_limit` 테이블 access port (ADR-0037 / TG-P3-14).
 */
interface RiskLimitRepositoryPort {
    suspend fun findByTenantId(tenantId: TenantId): RiskLimit?
    suspend fun save(limit: RiskLimit)
}
