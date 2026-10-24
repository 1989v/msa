package com.kgd.ranking.domain.cafe.model

import java.math.BigDecimal
import java.time.LocalDate

enum class CaffeineStatus { DISCLOSED, ZERO, DECAF, UNDISCLOSED }

/** Source values stay unchanged; classification and concentration are derived independently. */
data class CafeDrink(
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
    val displayName: String? = null,
    val adminNote: String? = null,
    val effectiveGroup: String? = null,
    val volumeOverridden: Boolean = false,
    val effectiveVolume: BigDecimal? = null,
    val effectiveVolumeSource: VolumeSource? = null,
    val officialSourceUrl: String? = null,
    val officialCheckedAt: LocalDate? = null,
    val correctionEvidence: Map<String, CafeCorrectionEvidence> = emptyMap(),
) {
    val drinkName: String get() = DrinkNames.normalize(displayName ?: menuName)
    val drinkGroup: String get() = effectiveGroup ?: DrinkGroups.classify(menuName)
    private val cupVolume get() = if (volumeOverridden) CupVolume(effectiveVolume, effectiveVolumeSource ?: if (effectiveVolume == null) VolumeSource.NONE else VolumeSource.ADMIN_VERIFIED) else CupVolumes.resolve(brandSlug, volumeMl, servingBasis, sizeLabel, temperature, sourceCategory)
    val cupVolumeMl: BigDecimal? get() = cupVolume.ml
    val volumeSource: VolumeSource get() = cupVolume.source
    val kcalPer100ml: BigDecimal? get() = per100ml(kcal)
    val sugarPer100ml: BigDecimal? get() = per100ml(sugarG)
    val caffeinePer100ml: BigDecimal? get() = per100ml(caffeineMg)

    private fun per100ml(value: BigDecimal?): BigDecimal? =
        cupVolumeMl?.takeIf { it.signum() > 0 }?.let { volume ->
            value?.multiply(BigDecimal(100))?.divide(volume, 4, java.math.RoundingMode.HALF_UP)
        }
}

/** More specific names precede broad latte/tea matches. Only menu names are classified. */
object DrinkGroups {
    private val rules = listOf(
        "스무디·프라페" to listOf(
            "스무디", "프라페", "프라푸치노", "플랫치노", "빽스치노", "쉐이크", "셰이크",
            "블렌디드", "쿨라타", "슬러시", "크러시", "크러쉬", "퐁당치노", "쉐이키",
        ),
        "고구마라떼" to listOf("고구마"),
        "말차·녹차라떼" to listOf("말차", "녹차"),
        "밀크티" to listOf("밀크티", "밀크 티"),
        "바닐라라떼" to listOf("바닐라라떼", "바닐라 라떼", "바닐라라테", "바닐라 라테"),
        "카페모카" to listOf("카페모카", "카페 모카", "모카"),
        "카라멜마끼아또" to listOf("마끼아또", "마키아토", "카라멜 마키아또", "카라멜마키아또", "마끼야또"),
        "콜드브루" to listOf("콜드브루", "콜드 브루", "더치"),
        "아메리카노" to listOf("아메리카노", "롱블랙"),
        "에스프레소" to listOf("에스프레소"),
        "카푸치노" to listOf("카푸치노"),
        "초코" to listOf("초코", "초콜릿", "초콜렛", "코코아"),
        "에이드" to listOf("에이드", "레모네이드", "모히또"),
        "탄산음료" to listOf("소다", "스파클링", "체리콜라", "체리콕", "피지오"),
        "라떼" to listOf("라떼", "라테", "플랫 화이트", "코르타도", "카페 브레베"),
        "주스" to listOf("주스", "쥬스"),
        "티" to listOf(
            "티", "차", "얼그레이", "얼 그레이", "캐모마일", "카모마일", "페퍼민트",
            "히비스커스", "루이보스", "자스민", "레몬머틀", "블랙퍼스트", "그나와 민트", "트리플민트",
            "아샷추", "아.샷.추", "아망추",
        ),
        "우유·요거트" to listOf("우유", "두유", "요거트"),
    )
    private val foodNames = listOf("케이크", "스콘", "샌드위치", "빵", "쿠키", "마카롱")
    private val explicitDrinkNames = listOf("티", "차", "드링크")

    fun classify(menuName: String): String {
        val group = rules.firstOrNull { (_, names) -> names.any { menuName.contains(it, ignoreCase = true) } }?.first
            ?: return "기타"
        // Ingredient-only names also occur in pastries; explicit drink names retain their classification.
        if (group in listOf("티", "우유·요거트") && foodNames.any { menuName.contains(it) } &&
            explicitDrinkNames.none { menuName.contains(it) }
        ) return "기타"
        return group
    }
}

data class CafeCorrectionEvidence(val evidenceUrl: String, val evidenceCheckedAt: LocalDate, val reason: String)
