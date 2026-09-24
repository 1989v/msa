package com.kgd.order.domain.sheet.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/** 안분 — 원 단위 값으로 판정한다. 라인 합 = 할인 총액, 잔차는 금액이 가장 큰 라인(동률이면 앞 라인). */
class AllocationTest : BehaviorSpec({

    given("세 라인 10,000 · 20,000 · 30,000 에 1,000원을 나누면") {
        val shares = Allocation.allocate(1_000L, listOf(10_000L, 20_000L, 30_000L))
        then("내림 166 · 333 · 500, 잔차 1원은 가장 큰 30,000 라인에") { shares shouldBe listOf(166L, 333L, 501L) }
        then("라인 합 = 할인 총액") { shares.sum() shouldBe 1_000L }
    }

    given("나누어떨어지지 않으면") {
        then("내림 뒤 남은 원은 금액이 가장 큰 라인에 붙는다 — 뒤에 있어도") {
            // 100 × 1000/6000 = 16.66 → 16, 100 × 2000/6000 = 33.33 → 33, 100 × 3000/6000 = 50 → 50, 잔차 1
            Allocation.allocate(100L, listOf(1_000L, 2_000L, 3_000L)) shouldBe listOf(16L, 33L, 51L)
        }
        then("가장 큰 라인이 둘이면 앞 라인에 붙는다") {
            // 100 × 1/3 = 33.33 → 33 셋, 잔차 1 → 첫 라인
            Allocation.allocate(100L, listOf(3_000L, 3_000L, 3_000L)) shouldBe listOf(34L, 33L, 33L)
        }
        then("동률 최대가 뒤쪽 둘이면 그중 앞 라인") {
            Allocation.allocate(10L, listOf(1_000L, 3_000L, 3_000L)) shouldBe listOf(1L, 5L, 4L)
        }
    }

    given("잔차가 가장 큰 라인의 남은 금액보다 크면") {
        then("그 라인은 자기 금액까지만 받고 나머지는 다음으로 큰 라인에 — 라인 결제액이 음수가 되지 않는다") {
            // 20,000 × 10,000/20,001 = 9,999.5 → 9,999 두 번, 1 라인은 0.99 → 0, 잔차 2
            // 첫 라인 남은 금액 1 → 1 받고, 남은 1 은 둘째 라인
            val shares = Allocation.allocate(20_000L, listOf(10_000L, 10_000L, 1L))
            shares shouldBe listOf(10_000L, 10_000L, 0L)
            shares.sum() shouldBe 20_000L
        }
    }

    given("경계") {
        then("할인 0 이면 전부 0") { Allocation.allocate(0L, listOf(1_000L, 2_000L)) shouldBe listOf(0L, 0L) }
        then("할인 = 금액 합이면 라인 금액 그대로") {
            Allocation.allocate(3_000L, listOf(1_000L, 2_000L)) shouldBe listOf(1_000L, 2_000L)
        }
        then("할인이 금액 합보다 크면 거부") {
            shouldThrow<IllegalArgumentException> { Allocation.allocate(3_001L, listOf(1_000L, 2_000L)) }
        }
        then("큰 금액도 넘치지 않는다") {
            val shares = Allocation.allocate(9_000_000_000L, listOf(5_000_000_000L, 5_000_000_000L))
            shares shouldBe listOf(4_500_000_000L, 4_500_000_000L)
        }
    }
})
