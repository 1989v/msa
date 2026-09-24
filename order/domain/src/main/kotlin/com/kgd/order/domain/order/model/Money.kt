package com.kgd.order.domain.order.model

/** 원 단위 금액(KRW 고정). 소수 원은 없다 — 정률·수수료 계산은 규칙대로 정수로 떨어뜨린 뒤 여기에 담는다. */
@JvmInline
value class Money(val amount: Long) {
    init {
        require(amount >= 0) { "금액은 0 이상이어야 합니다" }
    }

    operator fun plus(other: Money) = Money(Math.addExact(amount, other.amount))
    operator fun times(quantity: Int) = Money(Math.multiplyExact(amount, quantity.toLong()))

    companion object {
        val ZERO = Money(0L)
    }
}
