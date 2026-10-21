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
    @get:com.fasterxml.jackson.annotation.JsonIgnore val rawNutrition: Map<String, String>,
    val priceKrw: Int? = null,
    val priceNote: String? = null,
    val allergens: String? = null,
    val sourceUrl: String,
    val checkedAt: LocalDate,
    val notes: String? = null,
    val drinkGroup: String,
    val sugarPer100ml: BigDecimal?,
    val caffeinePer100ml: BigDecimal?,
    val cupVolumeMl: BigDecimal? = null,
    val volumeSource: VolumeSource = VolumeSource.NONE,
    val kcalPer100ml: BigDecimal? = null,
    val drinkKey: String = "",
    val drinkName: String = "",
    val displayName: String? = null,
    val officialSourceUrl: String? = null,
    val officialCheckedAt: LocalDate? = null,
    val correctionEvidence: Map<String, CafeCorrectionEvidence> = emptyMap(),
) {
    companion object {
        fun of(drink: CafeDrink) = CafeDrinkResponse(
            brandSlug = drink.brandSlug,
            brandName = drink.brandName,
            menuName = drink.displayName ?: drink.menuName,
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
            cupVolumeMl = drink.cupVolumeMl,
            volumeSource = drink.volumeSource,
            kcalPer100ml = drink.kcalPer100ml,
            drinkKey = CafeDrinkKey.of(drink),
            drinkName = drink.drinkName,
            displayName = drink.displayName,
            officialSourceUrl = drink.officialSourceUrl ?: drink.sourceUrl,
            officialCheckedAt = drink.officialCheckedAt ?: drink.checkedAt,
            correctionEvidence = drink.correctionEvidence,
        )
    }
}

data class CafeDrinkBulkRequest(val drinks: List<CafeDrinkUpsertItem>, val parentRunId: String? = null)
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
    val size: Int = 20,
    val basis: String = "serving",
    val caffeineStatus: List<CaffeineStatus> = emptyList(),
    val direction: String = "asc",
) {
    init {
        require(direction in setOf("asc", "desc")) { "Unknown direction" }
        require(page >= 0 && size in 1..200) { "page >= 0, size 1..200" }
        require(sort in setOf("sugar", "caffeine", "kcal", "sugarPer100ml")) { "Unknown sort" }
        require(basis in setOf("serving", "100ml")) { "Unknown basis" }
        require(caffeine == null || caffeine in setOf("none", "zero", "decaf")) { "Unknown caffeine filter" }
        require(caffeine == null || caffeineStatus.isEmpty()) { "Use caffeine or caffeineStatus, not both" }
        require(maxSugar == null || maxSugar.signum() >= 0)
        require(maxCaffeine == null || maxCaffeine.signum() >= 0)
    }
}

data class CafeDrinkNameCount(val drinkName: String, val brandCount: Int, val rowCount: Long)
data class CafeDrinkBrandVariants(val brandSlug: String, val brandName: String, val representative: CafeDrinkResponse, val variants: List<CafeDrinkResponse>)
