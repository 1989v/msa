package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.LiveTradingMode

/**
 * LiveModeRepositoryPort — `live_trading_state` 테이블 access (ADR-0037 / TG-P3-04).
 */
interface LiveModeRepositoryPort {
    suspend fun findByTenantId(tenantId: TenantId): LiveTradingMode
    suspend fun save(state: LiveTradingMode)
}
