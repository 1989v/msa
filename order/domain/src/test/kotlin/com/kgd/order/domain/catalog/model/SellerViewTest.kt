package com.kgd.order.domain.catalog.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

/** 읽기 모델은 늦게 도착한 옛 이벤트로 되돌아가지 않는다(아웃박스 재시도는 순서를 뒤집을 수 있다). */
class SellerViewTest : BehaviorSpec({
    val t = Instant.parse("2026-10-01T00:00:00Z")
    val current = SellerView(7L, "SUSPENDED", 1_200, 3_000L, t)

    given("판매자 읽기 모델") {
        then("더 오래된 이벤트는 반영하지 않는다") {
            current.isSupersededBy(SellerView(7L, "ACTIVE", 1_200, 3_000L, t.minusMillis(1))) shouldBe false
        }
        then("같은 시각이나 더 새 이벤트는 반영한다") {
            current.isSupersededBy(SellerView(7L, "ACTIVE", 1_200, 3_000L, t)) shouldBe true
            current.isSupersededBy(SellerView(7L, "ACTIVE", 1_200, 3_000L, t.plusMillis(1))) shouldBe true
        }
        then("ACTIVE 이고 수수료율이 있어야 판매 가능") {
            SellerView(7L, "ACTIVE", 1_200, 0L, t).isSellable shouldBe true
            SellerView(7L, "ACTIVE", null, 0L, t).isSellable shouldBe false
            current.isSellable shouldBe false
        }
    }
})
