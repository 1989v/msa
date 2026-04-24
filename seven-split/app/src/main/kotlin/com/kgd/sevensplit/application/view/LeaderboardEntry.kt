package com.kgd.sevensplit.application.view

import com.kgd.sevensplit.application.port.persistence.BacktestRunRecord
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import java.math.BigDecimal
import java.time.Instant

/**
 * LeaderboardEntry — 테넌트 내부 리더보드 한 행.
 *
 * 산식: "실현 PnL 절대값 기준 내림차순" (OQ-010 해소 전 기본값).
 * OQ-010 resolution 후 MDD/Sharpe 가중 산식으로 교체될 수 있다.
 */
data class LeaderboardEntry(
    val runId: RunId,
    val strategyId: StrategyId,
    val targetSymbol: String,
    val realizedPnl: BigDecimal,
    val fillCount: Long,
    val completedAt: Instant
) {
    companion object {
        fun from(record: BacktestRunRecord): LeaderboardEntry = LeaderboardEntry(
            runId = record.runId,
            strategyId = record.strategyId,
            targetSymbol = record.symbol,
            realizedPnl = record.realizedPnl,
            fillCount = record.fillCount,
            completedAt = record.endedAt
        )
    }
}
