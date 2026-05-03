package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.SignalStrategy

/**
 * SignalStrategyRepositoryPort — `SignalStrategy` 영속화 port (ADR-0033).
 *
 * 모든 시그니처는 INV-05 (tenantId 격리) 준수.
 */
interface SignalStrategyRepositoryPort {
    suspend fun save(strategy: SignalStrategy): SignalStrategy
    suspend fun findById(tenantId: TenantId, id: StrategyId): SignalStrategy?
    suspend fun findAll(tenantId: TenantId): List<SignalStrategy>
    suspend fun delete(tenantId: TenantId, id: StrategyId)
}
