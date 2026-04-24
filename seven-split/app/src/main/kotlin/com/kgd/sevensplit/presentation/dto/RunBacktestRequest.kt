package com.kgd.sevensplit.presentation.dto

import com.kgd.sevensplit.application.usecase.RunBacktestCommand
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import jakarta.validation.constraints.NotBlank
import java.time.Instant

/**
 * RunBacktestRequest — `POST /api/v1/backtests` body.
 *
 * - `strategyId` 는 UUID 문자열.
 * - `from`, `to` 는 ISO-8601 instant. 백테스트 기간은 반개구간.
 * - `seed` 는 결정론 보장용 선택 인자. null 이면 서버에서 clock millis 로 채움.
 */
data class RunBacktestRequest(
    @field:NotBlank
    val strategyId: String,

    val from: Instant,

    val to: Instant,

    val seed: Long? = null
) {
    fun toCommand(tenantId: TenantId): RunBacktestCommand = RunBacktestCommand(
        tenantId = tenantId,
        strategyId = StrategyId.of(strategyId),
        from = from,
        to = to,
        seed = seed
    )
}
