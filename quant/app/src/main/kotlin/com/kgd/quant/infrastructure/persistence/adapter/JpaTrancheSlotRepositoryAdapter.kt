package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.TrancheSlotRepositoryPort
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.tranche.TrancheSlot
import com.kgd.quant.infrastructure.persistence.mapper.TrancheSlotMapper
import com.kgd.quant.infrastructure.persistence.repository.TrancheSlotJpaRepository
import com.kgd.quant.infrastructure.persistence.repository.StrategyRunJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component

/**
 * TG-08.5: `TrancheSlotRepositoryPort` 의 JPA 기반 구현.
 *
 * ## tenantId 규칙 (INV-05)
 * 도메인 `TrancheSlot` 은 `tenantId` 필드를 가지지 않는다. Port `save(slot)` 은 호환성을 위해
 * tenantId 를 받지 않으므로 다음 순서로 tenantId 를 해결한다:
 *
 *  1) 기존 레코드가 있으면 기존 `tenant_id` 값을 그대로 보존한다 (update 경로).
 *  2) 기존 레코드가 없으면 `strategy_run` 테이블을 조회해 부모 run 의 `tenant_id` 를 상속한다.
 *  3) 그래도 찾을 수 없으면 [IllegalStateException] — 부모 run 없이 slot 을 저장하는 것은 허용되지 않는다.
 *
 * TODO: port 를 `save(tenantId, slot)` 시그니처로 확장하면 lookup 비용을 제거할 수 있다 (TG-09 리팩터링).
 */
@Component
class JpaTrancheSlotRepositoryAdapter(
    private val jpa: TrancheSlotJpaRepository,
    private val runJpa: StrategyRunJpaRepository,
    private val clock: Clock
) : TrancheSlotRepositoryPort {

    override suspend fun save(slot: TrancheSlot): TrancheSlot = withContext(Dispatchers.IO) {
        val now = clock.now()
        val existing = jpa.findById(slot.id.value).orElse(null)
        val tenantId: TenantId = if (existing != null) {
            TenantId(existing.tenantId)
        } else {
            val run = runJpa.findById(slot.runId.value).orElse(null)
                ?: throw IllegalStateException(
                    "TrancheSlot cannot be persisted before its parent StrategyRun (runId=${slot.runId.value})"
                )
            TenantId(run.tenantId)
        }
        val entity = if (existing == null) {
            TrancheSlotMapper.toEntity(slot, tenantId, updatedAt = now)
        } else {
            TrancheSlotMapper.applyToEntity(existing, slot, tenantId, updatedAt = now)
        }
        TrancheSlotMapper.toDomain(jpa.save(entity))
    }

    override suspend fun findByRunId(tenantId: TenantId, runId: RunId): List<TrancheSlot> =
        withContext(Dispatchers.IO) {
            jpa.findAllByRunIdAndTenantIdOrderByRoundIndexAsc(runId.value, tenantId.value)
                .map { TrancheSlotMapper.toDomain(it) }
        }

    override suspend fun findByRunIdAndRoundIndex(
        tenantId: TenantId,
        runId: RunId,
        roundIndex: Int
    ): TrancheSlot? = withContext(Dispatchers.IO) {
        jpa.findByRunIdAndTenantIdAndRoundIndex(runId.value, tenantId.value, roundIndex)
            ?.let { TrancheSlotMapper.toDomain(it) }
    }
}
