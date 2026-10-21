package com.kgd.ranking.infrastructure.persistence.entity

import java.math.BigDecimal
import java.time.LocalDate
import com.kgd.ranking.domain.cafe.model.*
import jakarta.persistence.*
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.json.JsonMapper

@Entity
@Table(name = "cafe_drink_effective")
class CafeEffectiveDrinkJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "brand_slug", nullable = false, length = 40)
    val brandSlug: String,
    @Column(name = "brand_name", nullable = false, length = 255)
    val brandName: String,
    @Column(name = "menu_name", nullable = false, length = 255)
    val menuName: String,
    @Column(name = "menu_name_en", nullable = true, length = 255)
    val menuNameEn: String? = null,
    @Column(name = "source_category", nullable = true, length = 255)
    val sourceCategory: String? = null,
    @Column(name = "temperature", nullable = false, length = 20)
    val temperature: String = "",
    @Column(name = "size_label", nullable = false, length = 60)
    val sizeLabel: String = "",
    @Column(name = "volume_ml", nullable = true, precision = 14, scale = 4)
    val volumeMl: BigDecimal? = null,
    @Column(name = "serving_basis", nullable = true, length = 255)
    val servingBasis: String? = null,
    @Column(name = "kcal", nullable = true, precision = 14, scale = 4)
    val kcal: BigDecimal? = null,
    @Column(name = "sugar_g", nullable = true, precision = 14, scale = 4)
    val sugarG: BigDecimal? = null,
    @Column(name = "sodium_mg", nullable = true, precision = 14, scale = 4)
    val sodiumMg: BigDecimal? = null,
    @Column(name = "carbs_g", nullable = true, precision = 14, scale = 4)
    val carbsG: BigDecimal? = null,
    @Column(name = "fat_g", nullable = true, precision = 14, scale = 4)
    val fatG: BigDecimal? = null,
    @Column(name = "sat_fat_g", nullable = true, precision = 14, scale = 4)
    val satFatG: BigDecimal? = null,
    @Column(name = "protein_g", nullable = true, precision = 14, scale = 4)
    val proteinG: BigDecimal? = null,
    @Column(name = "caffeine_mg", nullable = true, precision = 14, scale = 4)
    val caffeineMg: BigDecimal? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "caffeine_status", nullable = false, length = 30)
    val caffeineStatus: CaffeineStatus,
    @Column(name = "raw_nutrition", columnDefinition = "TEXT", nullable = false)
    val rawNutrition: String,
    @Column(name = "price_krw", nullable = true)
    val priceKrw: Int? = null,
    @Column(name = "price_note", nullable = true, length = 255)
    val priceNote: String? = null,
    @Column(name = "allergens", nullable = true, columnDefinition = "TEXT")
    val allergens: String? = null,
    @Column(name = "source_url", nullable = false, length = 2048)
    val sourceUrl: String,
    @Column(name = "checked_at", nullable = false)
    val checkedAt: LocalDate,
    @Column(name = "notes", nullable = true, columnDefinition = "TEXT")
    val notes: String? = null,
    @Column(name = "drink_group", nullable = false)
    val drinkGroup: String,
    @Column(name = "sugar_per_100ml", precision = 14, scale = 4)
    val sugarPer100ml: BigDecimal?,
    @Column(name = "caffeine_per_100ml", precision = 14, scale = 4)
    val caffeinePer100ml: BigDecimal?,
    @Column(name = "cup_volume_ml", precision = 14, scale = 4)
    val cupVolumeMl: BigDecimal? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "volume_source", nullable = false, length = 30)
    val volumeSource: VolumeSource = VolumeSource.NONE,
    @Column(name = "kcal_per_100ml", precision = 14, scale = 4)
    val kcalPer100ml: BigDecimal? = null,
    @Column(name = "drink_name", nullable = false, length = 255)
    val drinkName: String = DrinkNames.normalize(menuName),
    @Column(name = "display_name", length = 255) val displayName: String? = null,
    @Column(name = "official_source_url", length = 2048) val officialSourceUrl: String? = null,
    @Column(name = "official_checked_at") val officialCheckedAt: LocalDate? = null,
    @Column(name = "correction_evidence", columnDefinition = "LONGTEXT") val correctionEvidence: String? = null,
) {
    fun toDomain() = CafeDrink(
        effectiveGroup = drinkGroup,
        volumeOverridden = true,
        effectiveVolume = cupVolumeMl,
        effectiveVolumeSource = volumeSource,
        displayName = displayName,
        officialSourceUrl = officialSourceUrl ?: sourceUrl,
        officialCheckedAt = officialCheckedAt ?: checkedAt,
        correctionEvidence = correctionEvidence?.let { mapper.readValue(it, object : TypeReference<Map<String, CafeCorrectionEvidence>>() {}) } ?: emptyMap(),
        brandSlug = brandSlug,
        brandName = brandName,
        menuName = menuName,
        menuNameEn = menuNameEn,
        sourceCategory = sourceCategory,
        temperature = temperature.ifEmpty { null },
        sizeLabel = sizeLabel.ifEmpty { null },
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
        rawNutrition = mapper.readValue(rawNutrition, object : TypeReference<Map<String, String>>() {}),
        priceKrw = priceKrw,
        priceNote = priceNote,
        allergens = allergens,
        sourceUrl = sourceUrl,
        checkedAt = checkedAt,
        notes = notes,
    )
    companion object {
        private val mapper = JsonMapper.builder().findAndAddModules().build()
        fun fromDomain(drink: CafeDrink) = CafeEffectiveDrinkJpaEntity(
            drinkName = drink.drinkName,
            displayName = drink.displayName,
            officialSourceUrl = drink.officialSourceUrl ?: drink.sourceUrl,
            officialCheckedAt = drink.officialCheckedAt ?: drink.checkedAt,
            correctionEvidence = mapper.writeValueAsString(drink.correctionEvidence),
            brandSlug = drink.brandSlug,
            brandName = drink.brandName,
            menuName = drink.menuName,
            menuNameEn = drink.menuNameEn,
            sourceCategory = drink.sourceCategory,
            temperature = drink.temperature.orEmpty(),
            sizeLabel = drink.sizeLabel.orEmpty(),
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
            rawNutrition = mapper.writeValueAsString(drink.rawNutrition),
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
        )
    }
}
