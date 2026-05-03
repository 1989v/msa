package com.kgd.quant.domain.strategy

import java.math.BigDecimal

/**
 * PositionSizing — 진입 규모 결정 sealed.
 *
 * - [FixedKrw]        진입 1회당 고정 KRW 금액
 * - [PercentBalance]  잔고 대비 % (0 < p ≤ 100)
 * - [FixedQuantity]   진입 1회당 고정 수량
 *
 * 시그널 strategy 는 진입 시점에 본 sizing 을 평가해 OrderCommand.quantity 를 계산한다.
 */
sealed interface PositionSizing {
    fun describe(): String
}

data class FixedKrw(val amountKrw: BigDecimal) : PositionSizing {
    init {
        require(amountKrw > BigDecimal.ZERO) { "amountKrw must be > 0 (got $amountKrw)" }
    }
    override fun describe(): String = "FixedKrw=${amountKrw}"
}

data class PercentBalance(val percent: BigDecimal) : PositionSizing {
    init {
        require(percent > BigDecimal.ZERO && percent <= BigDecimal("100")) {
            "percent must be in (0, 100] (got $percent)"
        }
    }
    override fun describe(): String = "PercentBalance=${percent}%"
}

data class FixedQuantity(val quantity: BigDecimal) : PositionSizing {
    init {
        require(quantity > BigDecimal.ZERO) { "quantity must be > 0 (got $quantity)" }
    }
    override fun describe(): String = "FixedQuantity=${quantity}"
}
