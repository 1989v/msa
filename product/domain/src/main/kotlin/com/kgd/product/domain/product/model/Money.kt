package com.kgd.product.domain.product.model

import java.math.BigDecimal

@JvmInline
value class Money(val amount: BigDecimal) {
    init { require(amount > BigDecimal.ZERO) { "금액은 0보다 커야 합니다" } }
    operator fun plus(other: Money) = Money(amount + other.amount)
}
