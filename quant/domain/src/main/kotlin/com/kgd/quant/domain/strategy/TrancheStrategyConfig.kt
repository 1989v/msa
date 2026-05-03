package com.kgd.quant.domain.strategy

import com.kgd.quant.domain.common.Percent
import com.kgd.quant.domain.exception.TrancheStrategyConfigInvalidException
import java.math.BigDecimal

/**
 * 7분할 전략 설정 VO.
 *
 * INV-07 검증:
 *   - roundCount ∈ [1, 50]
 *   - entryGapPercent < 0 (하락 간격이므로 음수)
 *   - takeProfitPercentPerRound.size == roundCount
 *   - 모든 takeProfitPercent > 0
 *   - initialOrderAmount > 0
 *
 * 불변식은 생성자 `init` 블록에서 검증하여, 이 VO를 가진 시점에는 config가 valid 하다는 걸 보장.
 */
data class TrancheStrategyConfig(
    val roundCount: Int,
    val entryGapPercent: Percent,
    val takeProfitPercentPerRound: List<Percent>,
    val initialOrderAmount: BigDecimal,
    val targetSymbol: String
) {
    init {
        if (roundCount !in MIN_ROUND..MAX_ROUND) {
            throw TrancheStrategyConfigInvalidException(
                "roundCount must be in [$MIN_ROUND, $MAX_ROUND] but was $roundCount"
            )
        }
        if (!entryGapPercent.isNegative()) {
            throw TrancheStrategyConfigInvalidException(
                "entryGapPercent must be negative (drop ratio) but was ${entryGapPercent.value}"
            )
        }
        if (takeProfitPercentPerRound.size != roundCount) {
            throw TrancheStrategyConfigInvalidException(
                "takeProfitPercentPerRound.size(${takeProfitPercentPerRound.size}) must equal roundCount($roundCount)"
            )
        }
        if (takeProfitPercentPerRound.any { !it.isPositive() }) {
            throw TrancheStrategyConfigInvalidException(
                "all takeProfitPercentPerRound must be positive but was $takeProfitPercentPerRound"
            )
        }
        if (initialOrderAmount <= BigDecimal.ZERO) {
            throw TrancheStrategyConfigInvalidException(
                "initialOrderAmount must be positive but was $initialOrderAmount"
            )
        }
        if (targetSymbol.isBlank()) {
            throw TrancheStrategyConfigInvalidException(
                "targetSymbol must not be blank"
            )
        }
    }

    fun takeProfitPercentAt(roundIndex: Int): Percent {
        require(roundIndex in 0 until roundCount) {
            "roundIndex($roundIndex) must be in [0, $roundCount)"
        }
        return takeProfitPercentPerRound[roundIndex]
    }

    companion object {
        const val MIN_ROUND = 1
        const val MAX_ROUND = 50
    }
}
