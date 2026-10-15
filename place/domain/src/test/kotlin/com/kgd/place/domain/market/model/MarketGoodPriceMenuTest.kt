package com.kgd.place.domain.market.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class MarketGoodPriceMenuTest : BehaviorSpec({
    Given("원본 메뉴와 가격 네 쌍") {
        Then("빈 메뉴는 버리고 숫자만 가격으로 읽으며 빈 값과 정수 범위 초과는 null이다") {
            GoodPriceMenu.from(mapOf("메뉴1" to " 칼국수 ", "가격1" to "7,000원",
                "메뉴2" to "  ", "가격2" to "1000", "메뉴3" to "수제비", "가격3" to "",
                "메뉴4" to "국밥", "가격4" to "999999999999")) shouldBe listOf(
                GoodPriceMenu("칼국수", 7000), GoodPriceMenu("수제비", null), GoodPriceMenu("국밥", null))
            GoodPriceMenu.from(emptyMap()) shouldBe emptyList()
        }
    }
})
