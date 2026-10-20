package com.kgd.ranking.domain.cafe.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.LocalDate

class DrinkGroupsTest : BehaviorSpec({
    Given("공식 메뉴의 다양한 표기") {
        listOf(
            "아이스 카페 아메리카노" to "아메리카노", "카페 라떼" to "라떼",
            "바닐라 라떼" to "바닐라라떼", "카페 모카" to "카페모카",
            "카라멜 마끼아또" to "카라멜마끼아또", "바닐라 콜드브루" to "콜드브루",
            "에스프레소" to "에스프레소", "고구마 라떼" to "고구마라떼",
            "말차 라떼" to "말차·녹차라떼", "녹차라떼" to "말차·녹차라떼",
            "얼그레이 밀크 티" to "밀크티", "초코 라떼" to "초코",
            "레몬 에이드" to "에이드", "딸기 스무디" to "스무디·프라페",
            "말차 프라푸치노" to "스무디·프라페", "레몬 티" to "티", "우유" to "기타",
        ).forEach { (name, expected) ->
            Then("$name → $expected") { DrinkGroups.classify(name) shouldBe expected }
        }
    }
    Given("공개 용량과 영양 수치") {
        val drink = CafeDrink(brandSlug = "sample", brandName = "샘플", menuName = "음료", volumeMl = BigDecimal("400"),
            sugarG = BigDecimal("12"), caffeineMg = BigDecimal("80"), caffeineStatus = CaffeineStatus.DISCLOSED,
            rawNutrition = emptyMap(), sourceUrl = "https://example.com", checkedAt = LocalDate.of(2026, 10, 20))
        Then("100ml당 값을 계산하되 용량 미공개·0 또는 영양 미공개는 추정하지 않는다") {
            drink.sugarPer100ml shouldBe BigDecimal("3.0000")
            drink.caffeinePer100ml shouldBe BigDecimal("20.0000")
            drink.copy(volumeMl = null).sugarPer100ml shouldBe null
            drink.copy(volumeMl = BigDecimal.ZERO).caffeinePer100ml shouldBe null
            drink.copy(sugarG = null).sugarPer100ml shouldBe null
        }
    }
})
