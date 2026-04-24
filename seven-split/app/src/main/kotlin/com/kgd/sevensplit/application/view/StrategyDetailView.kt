package com.kgd.sevensplit.application.view

import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.SplitStrategyConfig
import com.kgd.sevensplit.domain.strategy.StrategyStatus
import java.time.Instant

/**
 * StrategyDetailView — 전략 상세 조회 응답 DTO.
 *
 * Phase 1 은 생성 시각을 도메인 모델에 별도로 두지 않으므로 구성 시 호출자가 [Instant.now] 또는
 * Repository 메타데이터로 채워 주입한다. 실 서비스에서는 `SplitStrategyEntity.createdAt` 을
 * Mapper 에서 주입할 예정 (TG-10 에서 확장).
 */
data class StrategyDetailView(
    val strategyId: StrategyId,
    val tenantId: TenantId,
    val config: SplitStrategyConfig,
    val executionMode: ExecutionMode,
    val status: StrategyStatus,
    val createdAt: Instant?
) {
    companion object {
        fun from(strategy: SplitStrategy, createdAt: Instant? = null): StrategyDetailView =
            StrategyDetailView(
                strategyId = strategy.id,
                tenantId = strategy.tenantId,
                config = strategy.config,
                executionMode = strategy.executionMode,
                status = strategy.status,
                createdAt = createdAt
            )
    }
}
