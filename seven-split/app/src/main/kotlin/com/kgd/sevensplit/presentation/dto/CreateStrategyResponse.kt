package com.kgd.sevensplit.presentation.dto

import com.kgd.sevensplit.domain.common.StrategyId

/**
 * CreateStrategyResponse — `POST /api/v1/strategies` 응답 body.
 *
 * strategyId 는 UUID 문자열 포맷으로 직렬화한다 (도메인 내부 value class 누출 금지).
 */
data class CreateStrategyResponse(
    val strategyId: String
) {
    companion object {
        fun from(id: StrategyId): CreateStrategyResponse = CreateStrategyResponse(
            strategyId = id.value.toString()
        )
    }
}
