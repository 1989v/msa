package com.kgd.promotion.domain.point.model

import com.kgd.promotion.domain.point.exception.InsufficientPointsException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

/** 포인트 잔액은 0 아래로 내려가지 않고, 잔액 변경은 원장 한 줄과 함께만 일어난다. */
class PointBalanceTest : BehaviorSpec({
    val t0 = Instant.parse("2026-10-10T00:00:00Z")

    given("잔액 1,000") {
        fun balance() = PointBalance.open("7", t0).also { it.earn(1_000L, "grant:1", "1", "데모", t0) }

        then("1,001 사용은 거부되고 잔액이 그대로다") {
            val b = balance()
            shouldThrow<InsufficientPointsException> { b.use(1_001L, 100L, "reserve:100", t0) }
            b.balance shouldBe 1_000L
        }
        then("1,000 사용은 잔액 0 과 원장 -1,000 한 줄") {
            val b = balance()
            val entry = b.use(1_000L, 100L, "reserve:100", t0)
            b.balance shouldBe 0L
            entry.delta shouldBe -1_000L
            entry.balanceAfter shouldBe 0L
            entry.type shouldBe PointLedgerType.USE
            entry.orderId shouldBe 100L
        }
        then("0 이하 금액은 거부") {
            shouldThrow<IllegalArgumentException> { balance().use(0L, 100L, "reserve:100", t0) }
            shouldThrow<IllegalArgumentException> { balance().earn(-1L, "grant:2", "1", null, t0) }
        }
    }
})
