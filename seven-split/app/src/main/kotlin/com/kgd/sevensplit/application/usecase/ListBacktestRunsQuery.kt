package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.port.persistence.BacktestRunRepositoryPort
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.application.view.BacktestRunSummaryView
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import org.springframework.stereotype.Component

/**
 * ListBacktestRunsQuery — 백테스트 실행 목록 조회.
 *
 * ## Input
 * - `tenantId` (필수)
 * - `strategyId` (optional) — null 이면 테넌트의 전체 전략 run 을 병합.
 *
 * ## 흐름
 *  - strategyId 지정: `BacktestRunRepositoryPort.findCompletedByStrategy`
 *  - strategyId null: 테넌트 내 모든 전략 순회 후 병합 (Phase 1 naive). 전략 수가 많아지면
 *    Phase 2 에서 전용 테넌트 쿼리 추가.
 *
 * ## 트랜잭션
 * ClickHouse 읽기 — `@Transactional` 없음 (ADR-0020).
 */
@Component
class ListBacktestRunsQuery(
    private val backtestRunRepository: BacktestRunRepositoryPort,
    private val strategyRepository: StrategyRepositoryPort
) {
    suspend fun execute(
        tenantId: TenantId,
        strategyId: StrategyId? = null
    ): List<BacktestRunSummaryView> {
        val records = if (strategyId != null) {
            backtestRunRepository.findCompletedByStrategy(tenantId, strategyId)
        } else {
            // Phase 1 naive: 전략 목록 전체에 대해 순차 조회 후 flatMap.
            val strategies = strategyRepository.findAll(tenantId)
            strategies.flatMap { backtestRunRepository.findCompletedByStrategy(tenantId, it.id) }
        }
        return records
            .sortedByDescending { it.endedAt }
            .map { BacktestRunSummaryView.from(it) }
    }
}
