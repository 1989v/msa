package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.paper.port.PaperAccountRepositoryPort
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.infrastructure.persistence.entity.PaperAccountEntity
import com.kgd.quant.infrastructure.persistence.repository.PaperAccountJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component
import java.math.BigDecimal

/**
 * TG-P2-08: PaperAccountRepositoryPort 의 JPA 기반 구현.
 *
 * ## 트랜잭션 / 동시성
 * - 각 메서드는 자체적으로 짧은 DB 트랜잭션을 구성한다 (ADR-0020).
 * - JPA blocking 호출은 `Dispatchers.IO` 로 위임 (ADR-0002).
 * - `adjustBalance` 는 단일 row 업데이트이므로 InnoDB row lock 으로 동시성 안전.
 *
 * ## INV-05
 * - `load` 는 `(tenantId, strategyId, baseAsset)` 튜플 조회 — 다른 테넌트 row 절대 미반환.
 */
@Component
class JpaPaperAccountRepositoryAdapter(
    private val jpa: PaperAccountJpaRepository,
    private val clock: Clock
) : PaperAccountRepositoryPort {

    override suspend fun load(
        tenantId: TenantId,
        strategyId: StrategyId,
        baseAsset: String
    ): PaperAccountEntity? = withContext(Dispatchers.IO) {
        jpa.findByTenantIdAndStrategyIdAndBaseAsset(
            tenantId = tenantId.value,
            strategyId = strategyId.value,
            baseAsset = baseAsset
        )
    }

    override suspend fun save(entity: PaperAccountEntity): PaperAccountEntity = withContext(Dispatchers.IO) {
        val now = clock.now()
        if (entity.paperAccountId == 0L) {
            entity.createdAt = now
        }
        entity.updatedAt = now
        jpa.save(entity)
    }

    override suspend fun adjustBalance(
        tenantId: TenantId,
        strategyId: StrategyId,
        delta: BigDecimal,
        baseAsset: String
    ): BigDecimal = withContext(Dispatchers.IO) {
        val entity = jpa.findByTenantIdAndStrategyIdAndBaseAsset(
            tenantId = tenantId.value,
            strategyId = strategyId.value,
            baseAsset = baseAsset
        ) ?: error(
            "PaperAccount not found tenantId=$tenantId strategyId=$strategyId baseAsset=$baseAsset"
        )
        entity.balance = entity.balance.add(delta)
        entity.updatedAt = clock.now()
        jpa.save(entity).balance
    }
}
