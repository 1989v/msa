package com.kgd.ranking.domain.cafe.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.LocalDate

class CupVolumesTest : BehaviorSpec({
    val drink = CafeDrink(brandSlug = "twosome", brandName = "투썸", menuName = "음료",
        sugarG = BigDecimal("41.4"), caffeineMg = BigDecimal("82.8"), kcal = BigDecimal("207"),
        caffeineStatus = CaffeineStatus.DISCLOSED, rawNutrition = emptyMap(),
        sourceUrl = "https://example.com", checkedAt = LocalDate.of(2026, 10, 20))
    Given("공식 사이즈표와 원천 우선 규칙") {
        listOf(
            Triple("L", null, "473"), Triple("L", "HOT", "473"), Triple("L", "ICE", "473"),
            Triple("M", null, "591"), Triple("M", "ICE", "591"),
            Triple("R", "HOT", "355"), Triple("R", "ICE", "414"),
            Triple("R", null, null), Triple("SHORT", "HOT", null), Triple("S", "HOT", null),
            Triple("D", "HOT", null), Triple("ONE SIZE", null, null),
        ).forEach { (size, temperature, ml) ->
            Then("$size / $temperature → $ml") {
                val result = drink.copy(sizeLabel = size, temperature = temperature)
                result.cupVolumeMl shouldBe ml?.toBigDecimal()
                result.volumeSource shouldBe if (ml == null) VolumeSource.NONE else VolumeSource.BRAND_SIZE_TABLE
            }
        }
        Then("원천 ml는 표보다 우선이고 원천은 바꾸지 않는다") {
            val source = drink.copy(sizeLabel = "L", volumeMl = BigDecimal("500"))
            source.cupVolumeMl shouldBe source.volumeMl
            source.volumeSource shouldBe VolumeSource.ROW
        }
        Then("파생 컵 용량으로 세 영양 농도를 계산한다") {
            val ice = drink.copy(sizeLabel = "R", temperature = "ICE")
            ice.sugarPer100ml shouldBe BigDecimal("10.0000")
            ice.caffeinePer100ml shouldBe BigDecimal("20.0000")
            ice.kcalPer100ml shouldBe BigDecimal("50.0000")
            ice.volumeMl shouldBe null
            drink.copy(sizeLabel = "R").sugarPer100ml shouldBe null
        }
        Then("빽다방의 명시적 컵용량은 원천 ml로 파싱한다") {
            val paik = drink.copy(brandSlug = "paik", servingBasis = "※ 컵용량 : 510m")
            paik.cupVolumeMl shouldBe BigDecimal("510")
            paik.volumeSource shouldBe VolumeSource.ROW
            paik.volumeMl shouldBe null
            paik.copy(servingBasis = "컵용량 : 510mg").cupVolumeMl shouldBe null
        }
        Then("g만 공개한 행은 1g≈1ml 추정으로 표시하고 원천은 바꾸지 않는다") {
            listOf(
                Triple("dunkin", "1회 제공량(g) 310", "310"),
                Triple("parisbaguette", "총 내용량: 600g", "600"),
                Triple("ediya", "컵용량 : 30g", "30"),
                Triple("paik", "510g", "510"),
            ).forEach { (brand, basis, ml) ->
                val estimated = drink.copy(brandSlug = brand, servingBasis = basis)
                estimated.cupVolumeMl shouldBe ml.toBigDecimal()
                estimated.volumeSource shouldBe VolumeSource.WEIGHT_ESTIMATE
                estimated.volumeMl shouldBe null
            }
            drink.copy(brandSlug = "parisbaguette", servingBasis = "총 내용량: 제품 뒷면참조g").volumeSource shouldBe VolumeSource.NONE
            drink.copy(brandSlug = "dunkin", servingBasis = "카페인 120mg").volumeSource shouldBe VolumeSource.NONE
        }
        Then("투썸 프라페는 온도가 비어도 ICE R 용량을 쓴다") {
            val frappe = drink.copy(sizeLabel = "R", sourceCategory = "TROPICAL FRAPPE")
            frappe.cupVolumeMl shouldBe BigDecimal("414")
            frappe.volumeSource shouldBe VolumeSource.BRAND_SIZE_TABLE
            drink.copy(sizeLabel = "R", sourceCategory = "THE OTHERS").volumeSource shouldBe VolumeSource.NONE
        }
    }
})
