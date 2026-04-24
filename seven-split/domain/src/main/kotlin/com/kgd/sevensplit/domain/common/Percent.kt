package com.kgd.sevensplit.domain.common

import java.math.BigDecimal

/**
 * Percent value object — 퍼센트 표현. (예: 3.0 = 3%)
 *
 * - 범위 제약 없음. 음수(하락률) / 양수(상승률) 모두 허용.
 * - `toMultiplier()`는 `(1 + value/100)` 비율을 반환해 가격 계산에 쓰인다.
 */
@JvmInline
value class Percent(val value: BigDecimal) : Comparable<Percent> {

    override fun compareTo(other: Percent): Int = value.compareTo(other.value)

    /** (1 + value/100) — 가격에 곱하기 위한 배수. */
    fun toMultiplier(): BigDecimal =
        BigDecimal.ONE.add(value.divide(ONE_HUNDRED, MULTIPLIER_SCALE, java.math.RoundingMode.HALF_UP))

    fun isNegative(): Boolean = value.signum() < 0

    fun isPositive(): Boolean = value.signum() > 0

    companion object {
        private val ONE_HUNDRED = BigDecimal.valueOf(100)
        private const val MULTIPLIER_SCALE = 18

        val ZERO = Percent(BigDecimal.ZERO)

        fun of(value: String): Percent = Percent(BigDecimal(value))
        fun of(value: Long): Percent = Percent(BigDecimal.valueOf(value))
    }
}
