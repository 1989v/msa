package com.kgd.sevensplit.application.view

import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import java.math.BigDecimal
import java.time.Instant

/**
 * BacktestRunResultView — 백테스트 1 회 실행 결과 상세 응답.
 *
 * `events` 는 발행된 모든 도메인 이벤트의 요약 타임라인.
 * Phase 1 은 MDD/Sharpe 를 계산하지 않으므로 필드에 포함하지 않는다 (Phase 2+ 에서 확장).
 */
data class BacktestRunResultView(
    val runId: RunId,
    val strategyId: StrategyId,
    val tenantId: TenantId,
    val realizedPnl: BigDecimal,
    val fillCount: Long,
    val startedAt: Instant,
    val endedAt: Instant,
    val events: List<EventSummary>
)
