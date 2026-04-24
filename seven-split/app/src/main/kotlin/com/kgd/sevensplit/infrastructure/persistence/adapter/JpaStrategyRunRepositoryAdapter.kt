package com.kgd.sevensplit.infrastructure.persistence.adapter

import com.kgd.sevensplit.application.port.persistence.StrategyRunRepositoryPort
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.strategy.StrategyRun
import com.kgd.sevensplit.infrastructure.persistence.mapper.StrategyRunMapper
import com.kgd.sevensplit.infrastructure.persistence.repository.StrategyRunJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component

/**
 * TG-08.5: `StrategyRunRepositoryPort` 의 JPA 기반 구현.
 *
 * 조회 시그니처는 모두 `tenantId` 를 요구한다 (INV-05).
 */
@Component
class JpaStrategyRunRepositoryAdapter(
    private val jpa: StrategyRunJpaRepository
) : StrategyRunRepositoryPort {

    override suspend fun save(run: StrategyRun): StrategyRun = withContext(Dispatchers.IO) {
        val existing = jpa.findById(run.id.value).orElse(null)
        val entity = if (existing == null) {
            StrategyRunMapper.toEntity(run)
        } else {
            StrategyRunMapper.applyToEntity(existing, run)
        }
        val saved = jpa.save(entity)
        StrategyRunMapper.toDomain(saved)
    }

    override suspend fun findById(tenantId: TenantId, id: RunId): StrategyRun? =
        withContext(Dispatchers.IO) {
            jpa.findByRunIdAndTenantId(id.value, tenantId.value)
                ?.let { StrategyRunMapper.toDomain(it) }
        }

    override suspend fun findByStrategyId(
        tenantId: TenantId,
        strategyId: StrategyId
    ): List<StrategyRun> = withContext(Dispatchers.IO) {
        jpa.findAllByStrategyIdAndTenantIdOrderByStartedAtDesc(
            strategyId.value,
            tenantId.value
        ).map { StrategyRunMapper.toDomain(it) }
    }
}
