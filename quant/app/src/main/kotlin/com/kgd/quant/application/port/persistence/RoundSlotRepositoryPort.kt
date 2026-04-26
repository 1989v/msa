package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.slot.TrancheSlot

/**
 * TrancheSlotRepositoryPort — `TrancheSlot` 영속화 port.
 *
 * ## 계약
 * - 모든 조회 시그니처에 `tenantId` 포함 (INV-05).
 * - `findByRunIdAndRoundIndex` 는 특정 회차 슬롯 단건 조회. 없으면 null.
 * - `findByRunId` 는 roundIndex 오름차순을 구현체가 보장.
 */
interface TrancheSlotRepositoryPort {
    suspend fun save(slot: TrancheSlot): TrancheSlot
    suspend fun findByRunId(tenantId: TenantId, runId: RunId): List<TrancheSlot>
    suspend fun findByRunIdAndRoundIndex(tenantId: TenantId, runId: RunId, roundIndex: Int): TrancheSlot?
}
