package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.exception.StrategyNotFoundException
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.application.view.StrategyDetailView
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import org.springframework.stereotype.Component

/**
 * GetStrategyDetailQuery — 전략 단건 상세 조회.
 *
 * ## 흐름
 *  1. `StrategyRepositoryPort.findById(tenantId, strategyId)`
 *  2. null 이면 [StrategyNotFoundException] 발생 (404 매핑).
 *  3. [StrategyDetailView] 로 매핑해 반환.
 *
 * ## 트랜잭션
 * 단순 조회 — UseCase 에 `@Transactional` 을 걸지 않는다 (ADR-0020 §1).
 */
@Component
class GetStrategyDetailQuery(
    private val strategyRepository: StrategyRepositoryPort
) {
    suspend fun execute(tenantId: TenantId, strategyId: StrategyId): StrategyDetailView {
        val strategy = strategyRepository.findById(tenantId, strategyId)
            ?: throw StrategyNotFoundException(strategyId, tenantId)
        return StrategyDetailView.from(strategy)
    }
}
