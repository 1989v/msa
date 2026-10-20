package com.kgd.ranking.application.cafe.dto

import java.math.BigDecimal
import java.time.LocalDate
import com.kgd.ranking.domain.cafe.model.*

data class CafeDrinkUpsertItem(
    val brandSlug: String,
    val brandName: String,
    val menuName: String,
    val menuNameEn: String? = null,
    val sourceCategory: String? = null,
    val temperature: String? = null,
    val sizeLabel: String? = null,
    val volumeMl: BigDecimal? = null,
    val servingBasis: String? = null,
    val kcal: BigDecimal? = null,
    val sugarG: BigDecimal? = null,
    val sodiumMg: BigDecimal? = null,
    val carbsG: BigDecimal? = null,
    val fatG: BigDecimal? = null,
    val satFatG: BigDecimal? = null,
    val proteinG: BigDecimal? = null,
    val caffeineMg: BigDecimal? = null,
    val caffeineStatus: CaffeineStatus,
    val rawNutrition: Map<String, String>,
    val priceKrw: Int? = null,
    val priceNote: String? = null,
    val allergens: String? = null,
    val sourceUrl: String,
    val checkedAt: LocalDate,
    val notes: String? = null,
) {
    fun toDomain() = CafeDrink(
        brandSlug = brandSlug,
        brandName = brandName,
        menuName = menuName,
        menuNameEn = menuNameEn,
        sourceCategory = sourceCategory,
        temperature = temperature,
        sizeLabel = sizeLabel,
        volumeMl = volumeMl,
        servingBasis = servingBasis,
        kcal = kcal,
        sugarG = sugarG,
        sodiumMg = sodiumMg,
        carbsG = carbsG,
        fatG = fatG,
        satFatG = satFatG,
        proteinG = proteinG,
        caffeineMg = caffeineMg,
        caffeineStatus = caffeineStatus,
        rawNutrition = rawNutrition,
        priceKrw = priceKrw,
        priceNote = priceNote,
        allergens = allergens,
        sourceUrl = sourceUrl,
        checkedAt = checkedAt,
        notes = notes,
    )
}

data class CafeDrinkResponse(
    val brandSlug: String,
    val brandName: String,
    val menuName: String,
    val menuNameEn: String? = null,
    val sourceCategory: String? = null,
    val temperature: String? = null,
    val sizeLabel: String? = null,
    val volumeMl: BigDecimal? = null,
    val servingBasis: String? = null,
    val kcal: BigDecimal? = null,
    val sugarG: BigDecimal? = null,
    val sodiumMg: BigDecimal? = null,
    val carbsG: BigDecimal? = null,
    val fatG: BigDecimal? = null,
    val satFatG: BigDecimal? = null,
    val proteinG: BigDecimal? = null,
    val caffeineMg: BigDecimal? = null,
    val caffeineStatus: CaffeineStatus,
    val rawNutrition: Map<String, String>,
    val priceKrw: Int? = null,
    val priceNote: String? = null,
    val allergens: String? = null,
    val sourceUrl: String,
    val checkedAt: LocalDate,
    val notes: String? = null,
    val drinkGroup: String,
    val sugarPer100ml: BigDecimal?,
    val caffeinePer100ml: BigDecimal?,
) {
    companion object {
        fun of(drink: CafeDrink) = CafeDrinkResponse(
            brandSlug = drink.brandSlug,
            brandName = drink.brandName,
            menuName = drink.menuName,
            menuNameEn = drink.menuNameEn,
            sourceCategory = drink.sourceCategory,
            temperature = drink.temperature,
            sizeLabel = drink.sizeLabel,
            volumeMl = drink.volumeMl,
            servingBasis = drink.servingBasis,
            kcal = drink.kcal,
            sugarG = drink.sugarG,
            sodiumMg = drink.sodiumMg,
            carbsG = drink.carbsG,
            fatG = drink.fatG,
            satFatG = drink.satFatG,
            proteinG = drink.proteinG,
            caffeineMg = drink.caffeineMg,
            caffeineStatus = drink.caffeineStatus,
            rawNutrition = drink.rawNutrition,
            priceKrw = drink.priceKrw,
            priceNote = drink.priceNote,
            allergens = drink.allergens,
            sourceUrl = drink.sourceUrl,
            checkedAt = drink.checkedAt,
            notes = drink.notes,
            drinkGroup = drink.drinkGroup,
            sugarPer100ml = drink.sugarPer100ml,
            caffeinePer100ml = drink.caffeinePer100ml,
        )
    }
}

data class CafeDrinkBulkRequest(val drinks: List<CafeDrinkUpsertItem>)
data class CafeDrinkBulkResult(val received: Int, val replacedBrands: Set<String>)
data class CafeDrinkPage(val content: List<CafeDrinkResponse>, val totalElements: Long, val page: Int, val size: Int)
data class CafeGroupCount(val group: String, val count: Long)
data class CafeBrandCount(val brandSlug: String, val brandName: String, val count: Long, val sourceUrls: List<String>, val checkedAt: LocalDate)

data class CafeDrinkQuery(
    val q: String? = null,
    val brands: List<String> = emptyList(),
    val group: String? = null,
    val temperature: String? = null,
    val maxSugar: BigDecimal? = null,
    val maxCaffeine: BigDecimal? = null,
    val caffeine: String? = null,
    val sort: String = "sugar",
    val page: Int = 0,
    val size: Int = 50,
) {
    init {
        require(page >= 0 && size in 1..200) { "page >= 0, size 1..200" }
        require(sort in setOf("sugar", "caffeine", "kcal", "sugarPer100ml")) { "Unknown sort" }
        require(caffeine == null || caffeine == "none") { "Unknown caffeine filter" }
    }
}
