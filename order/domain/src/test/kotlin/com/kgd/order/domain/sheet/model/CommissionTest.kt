package com.kgd.order.domain.sheet.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/** 수수료 = 반올림(HALF_UP)(라인 순매출 × bp / 10000) — .5 경계에서 올린다. */
class CommissionTest : BehaviorSpec({
    given("수수료") {
        then("정확히 .5 이면 올린다 — 1,005 × 5% = 50.25 → 50, 1,010 × 5% = 50.5 → 51") {
            Commission.of(1_005L, 500) shouldBe 50L
            Commission.of(1_010L, 500) shouldBe 51L
        }
        then("999 × 12% = 119.88 → 120, 1,004 × 12.5% = 125.5 → 126, 1,003 × 12.5% = 125.375 → 125") {
            Commission.of(999L, 1_200) shouldBe 120L
            Commission.of(1_004L, 1_250) shouldBe 126L
            Commission.of(1_003L, 1_250) shouldBe 125L
        }
        then("율 0 이면 0") { Commission.of(12_345L, 0) shouldBe 0L }
    }
})
