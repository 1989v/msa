package com.kgd.sevensplit.infrastructure.persistence.adapter

import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.domain.common.Clock
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.infrastructure.persistence.mapper.SplitStrategyMapper
import com.kgd.sevensplit.infrastructure.persistence.repository.SplitStrategyJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component

/**
 * TG-08.5: `StrategyRepositoryPort` 의 JPA 기반 구현.
 *
 * ## 트랜잭션 / 동시성
 * - 각 메서드는 자체적으로 짧은 DB 트랜잭션을 구성한다 (ADR-0020 준수 — 클래스 레벨 `@Transactional` 금지).
 * - JPA 호출은 blocking 이므로 `Dispatchers.IO` 로 위임하여 coroutine caller 가 블로킹되지 않도록 한다.
 *
 * ## tenantId 격리 (INV-05)
 * - `findById` 는 `(strategyId, tenantId)` 튜플로 조회한다 — 다른 테넌트의 row 는 절대 반환하지 않음.
 * - `save` 는 도메인 `SplitStrategy.tenantId` 를 그대로 저장. 변경 시 도메인 메서드가 책임.
 */
@Component
class JpaStrategyRepositoryAdapter(
    private val jpa: SplitStrategyJpaRepository,
    private val mapper: SplitStrategyMapper,
    private val clock: Clock
) : StrategyRepositoryPort {

    override suspend fun save(strategy: SplitStrategy): SplitStrategy = withContext(Dispatchers.IO) {
        val now = clock.now()
        val existing = jpa.findById(strategy.id.value).orElse(null)
        val entity = if (existing == null) {
            mapper.toEntity(strategy, createdAt = now, updatedAt = now)
        } else {
            mapper.applyToEntity(existing, strategy, updatedAt = now)
        }
        val saved = jpa.save(entity)
        mapper.toDomain(saved)
    }

    override suspend fun findById(tenantId: TenantId, id: StrategyId): SplitStrategy? =
        withContext(Dispatchers.IO) {
            jpa.findByStrategyIdAndTenantId(id.value, tenantId.value)
                ?.let { mapper.toDomain(it) }
        }

    override suspend fun findAll(tenantId: TenantId): List<SplitStrategy> =
        withContext(Dispatchers.IO) {
            jpa.findAllByTenantId(tenantId.value).map { mapper.toDomain(it) }
        }
}
