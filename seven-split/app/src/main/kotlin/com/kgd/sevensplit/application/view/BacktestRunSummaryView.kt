package com.kgd.sevensplit.application.view

import com.kgd.sevensplit.application.port.persistence.BacktestRunRecord
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import java.math.BigDecimal
import java.time.Instant

/**
 * BacktestRunSummaryView — 백테스트 실행 목록 한 건.
 *
 * 리더보드/대시보드의 리스트 뷰에서 사용. 이벤트 타임라인은 포함하지 않는다.
 */
data class BacktestRunSummaryView(
    val runId: RunId,
    val strategyId: StrategyId,
    val targetSymbol: String,
    val realizedPnl: BigDecimal,
    val fillCount: Long,
    val startedAt: Instant,
    val endedAt: Instant
) {
    companion object {
        fun from(record: BacktestRunRecord): BacktestRunSummaryView = BacktestRunSummaryView(
            runId = record.runId,
            strategyId = record.strategyId,
            targetSymbol = record.symbol,
            realizedPnl = record.realizedPnl,
            fillCount = record.fillCount,
            startedAt = record.startedAt,
            endedAt = record.endedAt
        )
    }
}
