package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.StrategyRun

/**
 * StrategyRunRepositoryPort — `StrategyRun` 영속화 port.
 *
 * ## 계약
 * - 모든 조회 시그니처에 `tenantId` 포함 (INV-05).
 * - `findByStrategyId` 는 해당 전략의 모든 run 을 최신순(또는 구현체 명세) 으로 반환.
 */
interface StrategyRunRepositoryPort {
    suspend fun save(run: StrategyRun): StrategyRun
    suspend fun findById(tenantId: TenantId, id: RunId): StrategyRun?
    suspend fun findByStrategyId(tenantId: TenantId, strategyId: StrategyId): List<StrategyRun>
}
