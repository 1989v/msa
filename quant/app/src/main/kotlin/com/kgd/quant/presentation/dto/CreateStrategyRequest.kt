package com.kgd.quant.presentation.dto

import com.kgd.quant.application.usecase.CreateStrategyCommand
import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.Percent
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.TrancheStrategyConfig
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import java.math.BigDecimal

/**
 * CreateStrategyRequest — `POST /api/v1/strategies` body.
 *
 * 값 검증은 두 단계로 나뉜다.
 *  1. 표면적 검증: Jakarta Bean Validation (`@Min`, `@NotBlank` 등)
 *  2. 도메인 불변식(INV-07): [TrancheStrategyConfig] 생성자에서 수행 → 위반 시
 *     `TrancheStrategyConfigInvalidException` 을 던져 400 으로 매핑된다.
 *
 * `executionMode` 는 기본 "BACKTEST" 로 Phase 1 범위를 벗어나면 BAD_REQUEST.
 */
data class CreateStrategyRequest(
    @field:NotBlank
    val targetSymbol: String,

    @field:Min(1)
    @field:Max(50)
    val roundCount: Int,

    val entryGapPercent: BigDecimal,

    @field:NotEmpty
    val takeProfitPercentPerRound: List<BigDecimal>,

    val initialOrderAmount: BigDecimal,

    val executionMode: String = "BACKTEST"
) {
    fun toCommand(tenantId: TenantId): CreateStrategyCommand {
        val config = TrancheStrategyConfig(
            roundCount = roundCount,
            entryGapPercent = Percent(entryGapPercent),
            takeProfitPercentPerRound = takeProfitPercentPerRound.map { Percent(it) },
            initialOrderAmount = initialOrderAmount,
            targetSymbol = targetSymbol
        )
        val mode = runCatching { ExecutionMode.valueOf(executionMode) }
            .getOrElse {
                throw IllegalArgumentException(
                    "executionMode must be one of ${ExecutionMode.values().toList()} but was $executionMode"
                )
            }
        return CreateStrategyCommand(
            tenantId = tenantId,
            config = config,
            executionMode = mode
        )
    }
}
