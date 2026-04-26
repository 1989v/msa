package com.kgd.sevensplit.domain.common

import java.math.BigDecimal

/**
 * Quantity value object — 체결 수량 / 목표 수량을 표현한다.
 *
 * - 음수는 허용하지 않으나 0은 허용한다(초기 체결되지 않은 slot의 filledQty = 0).
 * - Price * Quantity = 금액(BigDecimal). 별도 Amount VO는 아직 도입하지 않는다.
 */
@JvmInline
value class Quantity(val value: BigDecimal) : Comparable<Quantity> {
    init {
        require(value >= BigDecimal.ZERO) { "Quantity must be non-negative: $value" }
    }

    override fun compareTo(other: Quantity): Int = value.compareTo(other.value)

    operator fun plus(other: Quantity): Quantity = Quantity(value.add(other.value))

    operator fun minus(other: Quantity): Quantity = Quantity(value.subtract(other.value))

    fun isZero(): Boolean = value.signum() == 0

    companion object {
        val ZERO = Quantity(BigDecimal.ZERO)

        fun of(value: String): Quantity = Quantity(BigDecimal(value))
        fun of(value: Long): Quantity = Quantity(BigDecimal.valueOf(value))
    }
}
