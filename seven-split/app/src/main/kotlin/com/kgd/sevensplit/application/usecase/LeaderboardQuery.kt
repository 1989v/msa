package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.port.persistence.BacktestRunRepositoryPort
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.application.view.LeaderboardEntry
import com.kgd.sevensplit.domain.common.TenantId
import org.springframework.stereotype.Component

/**
 * LeaderboardQuery — 테넌트 내부 리더보드 skeleton.
 *
 * ## 산식 (OQ-010 해소 전 기본값)
 * - 완료된 백테스트 run 들의 **실현 PnL 절대값 기준 내림차순**.
 * - Phase 1 은 단순 "성과 규모" 를 보여준다. MDD/Sharpe 가 도입되면 가중합 점수로 교체.
 *
 * ## 테넌트 격리 (INV-05)
 * `BacktestRunRepositoryPort.findCompletedByStrategy` 시그니처가 tenantId 를 필수로 요구해
 * compile time 에 누락이 차단된다.
 *
 * ## 한계
 * Phase 1 naive — 전략 목록을 순회하며 run 을 수집. 전략/런 수가 많아지면 Phase 2 에서
 * 테넌트 기준 전용 집계 쿼리로 교체해야 한다.
 */
@Component
class LeaderboardQuery(
    private val backtestRunRepository: BacktestRunRepositoryPort,
    private val strategyRepository: StrategyRepositoryPort
) {
    suspend fun execute(tenantId: TenantId, limit: Int = DEFAULT_LIMIT): List<LeaderboardEntry> {
        require(limit > 0) { "limit must be > 0 but was $limit" }

        val strategies = strategyRepository.findAll(tenantId)
        val allRuns = strategies.flatMap { backtestRunRepository.findCompletedByStrategy(tenantId, it.id) }

        return allRuns
            .sortedByDescending { it.realizedPnl.abs() }
            .take(limit)
            .map { LeaderboardEntry.from(it) }
    }

    companion object {
        const val DEFAULT_LIMIT = 20
    }
}
