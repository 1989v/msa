package com.kgd.order.domain.order.model

import java.math.BigDecimal

@JvmInline
value class Money(val amount: BigDecimal) {
    init {
        require(amount >= BigDecimal.ZERO) { "금액은 0 이상이어야 합니다" }
    }
    operator fun plus(other: Money) = Money(amount + other.amount)
}
