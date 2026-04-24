package com.kgd.sevensplit.domain.common

import java.math.BigDecimal

/**
 * Price value object — 양수만 허용한다.
 *
 * - 가격은 0 또는 음수가 될 수 없다는 도메인 불변식을 타입으로 강제한다.
 * - `compareTo`를 구현해 자연스러운 비교(`price1 >= price2`)가 가능하다.
 * - 퍼센트 연산은 [Percent.toMultiplier] 로 BigDecimal 배수를 구한 후 `Price * BigDecimal` 로 적용.
 */
@JvmInline
value class Price(val value: BigDecimal) : Comparable<Price> {
    init {
        require(value > BigDecimal.ZERO) { "Price must be positive: $value" }
    }

    override fun compareTo(other: Price): Int = value.compareTo(other.value)

    operator fun times(factor: BigDecimal): Price = Price(value.multiply(factor))

    companion object {
        fun of(value: String): Price = Price(BigDecimal(value))
        fun of(value: Long): Price = Price(BigDecimal.valueOf(value))
    }
}
