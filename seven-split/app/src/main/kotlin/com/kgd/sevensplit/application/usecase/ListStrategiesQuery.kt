package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.application.view.StrategySummaryView
import com.kgd.sevensplit.domain.common.TenantId
import org.springframework.stereotype.Component

/**
 * ListStrategiesQuery — 테넌트 범위의 전략 목록 조회.
 *
 * ## 흐름
 *  1. `StrategyRepositoryPort.findAll(tenantId)` — 어댑터는 tenantId 필터를 강제 (INV-05).
 *  2. [StrategySummaryView] 매핑.
 *
 * ## 트랜잭션
 * 단순 조회 — UseCase 에 `@Transactional` 을 걸지 않는다 (ADR-0020 §1).
 */
@Component
class ListStrategiesQuery(
    private val strategyRepository: StrategyRepositoryPort
) {
    suspend fun execute(tenantId: TenantId): List<StrategySummaryView> {
        val strategies = strategyRepository.findAll(tenantId)
        return strategies.map { StrategySummaryView.from(it) }
    }
}
