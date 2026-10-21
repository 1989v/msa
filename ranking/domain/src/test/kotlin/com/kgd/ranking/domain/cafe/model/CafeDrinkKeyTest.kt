package com.kgd.ranking.domain.cafe.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.time.LocalDate

class CafeDrinkKeyTest : BehaviorSpec({
    val row = CafeDrink(brandSlug = "a", brandName = "브랜드", menuName = "라떼|A_한글", temperature = "ICE", sizeLabel = "R", caffeineStatus = CaffeineStatus.DISCLOSED, rawNutrition = emptyMap(), sourceUrl = "https://example.com", checkedAt = LocalDate.of(2026, 10, 20))
    Given("공개 자연키") {
        Then("한글과 구분자를 손실 없이 왕복하고 URL 경로에 안전하다") {
            val key = CafeDrinkKey.of(row)
            key.matches(Regex("[A-Za-z0-9_-]+")) shouldBe true
            CafeDrinkKey.fields(key) shouldBe listOf("a", "라떼|A_한글", "ICE", "R", "DISCLOSED")
            CafeDrinkKey.fields(key + "extra") shouldBe null
        }
        Then("온도·사이즈·디카페인 변형은 서로 다른 키이며 원천 숫자는 키를 바꾸지 않는다") {
            CafeDrinkKey.of(row) shouldNotBe CafeDrinkKey.of(row.copy(temperature = "HOT"))
            CafeDrinkKey.of(row) shouldNotBe CafeDrinkKey.of(row.copy(sizeLabel = "L"))
            CafeDrinkKey.of(row) shouldNotBe CafeDrinkKey.of(row.copy(caffeineStatus = CaffeineStatus.DECAF))
            CafeDrinkKey.of(row) shouldBe CafeDrinkKey.of(row.copy(checkedAt = LocalDate.of(2026, 10, 21)))
            CafeDrinkKey.of(row.copy(sizeLabel = null)) shouldBe CafeDrinkKey.of(row.copy(sizeLabel = ""))
        }
    }
})
