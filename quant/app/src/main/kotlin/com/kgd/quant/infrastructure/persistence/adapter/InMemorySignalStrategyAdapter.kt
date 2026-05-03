package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.SignalStrategyRepositoryPort
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.SignalStrategy
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

/**
 * ⚠️ TEMPORARY — `SignalStrategyRepositoryPort` 의 in-memory stub.
 *
 * 정식 구현은 JPA + signal_strategy 테이블 (V20260504_001) — Phase 1 follow-up.
 * 현재는 ApplicationContext 와 컨트롤러 wire-up 검증을 위한 in-memory store.
 *
 * TODO(removal): JpaSignalStrategyAdapter 합류 후 본 클래스 삭제.
 */
@Component
class InMemorySignalStrategyAdapter : SignalStrategyRepositoryPort {

    private val store = ConcurrentHashMap<Pair<String, StrategyId>, SignalStrategy>()

    override suspend fun save(strategy: SignalStrategy): SignalStrategy {
        store[strategy.tenantId.value to strategy.id] = strategy
        return strategy
    }

    override suspend fun findById(tenantId: TenantId, id: StrategyId): SignalStrategy? =
        store[tenantId.value to id]

    override suspend fun findAll(tenantId: TenantId): List<SignalStrategy> =
        store.entries
            .filter { it.key.first == tenantId.value }
            .map { it.value }
            .sortedByDescending { it.createdAt }

    override suspend fun delete(tenantId: TenantId, id: StrategyId) {
        store.remove(tenantId.value to id)
    }
}
