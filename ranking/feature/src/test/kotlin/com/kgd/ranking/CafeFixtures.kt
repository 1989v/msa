package com.kgd.ranking

import com.kgd.ranking.application.cafe.dto.CafeDrinkUpsertItem
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import java.math.BigDecimal
import java.time.LocalDate

fun cafeItem(brand: String = "sample", name: String = "아메리카노", status: CaffeineStatus = CaffeineStatus.DISCLOSED) = CafeDrinkUpsertItem(
    brandSlug = brand, brandName = "공식 브랜드", menuName = name, menuNameEn = "Americano",
    sourceCategory = "커피", temperature = "ICE", sizeLabel = "Tall", volumeMl = BigDecimal("400"),
    servingBasis = "400 ml", kcal = BigDecimal("12"), sugarG = BigDecimal("8"), sodiumMg = BigDecimal("2.3"),
    carbsG = BigDecimal("3.4"), fatG = BigDecimal("4.5"), satFatG = BigDecimal("5.6"), proteinG = BigDecimal("6.7"),
    caffeineMg = BigDecimal("160"), caffeineStatus = status, rawNutrition = mapOf("카페인" to "160 mg", "당류" to "8 g"),
    priceKrw = 4500, priceNote = "공식 표시", allergens = "우유", sourceUrl = "https://example.com/menu",
    checkedAt = LocalDate.of(2026, 10, 20), notes = "원문 메모",
)
