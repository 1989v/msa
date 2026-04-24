package com.kgd.sevensplit.application.view

import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.StrategyStatus
import java.time.Instant

/**
 * StrategySummaryView — 전략 목록 응답 한 건.
 *
 * 대시보드/목록 화면에서 썸네일 수준으로 표시할 최소 필드만 포함.
 */
data class StrategySummaryView(
    val strategyId: StrategyId,
    val targetSymbol: String,
    val status: StrategyStatus,
    val createdAt: Instant?
) {
    companion object {
        fun from(strategy: SplitStrategy, createdAt: Instant? = null): StrategySummaryView =
            StrategySummaryView(
                strategyId = strategy.id,
                targetSymbol = strategy.config.targetSymbol,
                status = strategy.status,
                createdAt = createdAt
            )
    }
}
