package com.kgd.sevensplit.domain.strategy

import com.kgd.sevensplit.domain.common.Price

/**
 * 다음 회차 진입 조건을 표현하는 sealed 계층.
 *
 * - `Immediate` — 1회차처럼 즉시 시장가 매수 대상.
 * - `AtOrBelow(threshold)` — 현재가가 `threshold` 이하일 때 매수 트리거.
 *
 * Strategy/Slot 상태와 독립된 pure 표현이라 backtest engine / live engine이 공용 사용한다.
 */
sealed class PriceCondition {
    object Immediate : PriceCondition()

    data class AtOrBelow(val threshold: Price) : PriceCondition()

    /** 현재 가격이 조건을 만족하면 true. */
    fun isSatisfiedBy(currentPrice: Price): Boolean = when (this) {
        Immediate -> true
        is AtOrBelow -> currentPrice <= threshold
    }
}
