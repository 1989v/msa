package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.TrancheStrategy

/**
 * StrategyRepositoryPort — `TrancheStrategy` 영속화 port.
 *
 * ## 배치 위치
 * Application 레이어. 구현체는 `infrastructure.persistence` 의 JPA 어댑터 (TG-08).
 *
 * ## 계약
 * - 모든 조회 메서드는 `tenantId` 를 필수로 요구한다 (INV-05).
 * - `save` 는 신규/업데이트를 모두 처리(merge). 반환값은 영속화된 instance.
 * - JPA 기반 구현체는 `withContext(Dispatchers.IO)` 로 blocking 을 격리 (ADR-0002).
 */
interface StrategyRepositoryPort {
    suspend fun save(strategy: TrancheStrategy): TrancheStrategy
    suspend fun findById(tenantId: TenantId, id: StrategyId): TrancheStrategy?
    suspend fun findAll(tenantId: TenantId): List<TrancheStrategy>
}
