package com.kgd.product.domain.product.model

/** 원 단위 금액(KRW 고정). 소수 원은 없다 — 타입이 정수라 소수 가격은 만들 수 없다 */
@JvmInline
value class Money(val amount: Long) {
    init { require(amount > 0) { "금액은 0보다 커야 합니다" } }
    operator fun plus(other: Money) = Money(Math.addExact(amount, other.amount))
}
