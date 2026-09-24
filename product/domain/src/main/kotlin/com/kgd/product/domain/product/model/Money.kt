package com.kgd.product.domain.product.model

import java.math.BigDecimal

@JvmInline
value class Money(val amount: BigDecimal) {
    init { require(amount > BigDecimal.ZERO) { "금액은 0보다 커야 합니다" } }
    operator fun plus(other: Money) = Money(amount + other.amount)

    /** 원 단위(KRW)에는 소수가 없다 — 새로 쓰는 가격은 이것을 지켜야 한다. 컬럼 DECIMAL 은 확장-축소로 옮길 때까지 둔다 */
    val isWholeWon: Boolean get() = amount.stripTrailingZeros().scale() <= 0

    /** 원 단위 정수 — 소수부가 있으면 ArithmeticException */
    fun toWon(): Long = amount.longValueExact()
}
