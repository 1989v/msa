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
) {
    val drinkGroup: String get() = DrinkGroups.classify(menuName)
    val sugarPer100ml: BigDecimal? get() = per100ml(sugarG)
    val caffeinePer100ml: BigDecimal? get() = per100ml(caffeineMg)

    private fun per100ml(value: BigDecimal?): BigDecimal? =
        volumeMl?.takeIf { it.signum() > 0 }?.let { volume ->
            value?.multiply(BigDecimal(100))?.divide(volume, 4, java.math.RoundingMode.HALF_UP)
        }
}

/** More specific names precede broad latte/tea matches. Only menu names are classified. */
object DrinkGroups {
    private val rules = listOf(
        "스무디·프라페" to listOf("스무디", "프라페", "프라푸치노", "플랫치노", "빽스치노", "쉐이크", "셰이크"),
        "고구마라떼" to listOf("고구마"),
        "말차·녹차라떼" to listOf("말차", "녹차"),
        "밀크티" to listOf("밀크티", "밀크 티"),
        "바닐라라떼" to listOf("바닐라라떼", "바닐라 라떼", "바닐라라테", "바닐라 라테"),
        "카페모카" to listOf("카페모카", "카페 모카", "모카"),
        "카라멜마끼아또" to listOf("마끼아또", "마키아토", "마끼야또"),
        "콜드브루" to listOf("콜드브루", "콜드 브루", "더치"),
        "아메리카노" to listOf("아메리카노"),
        "에스프레소" to listOf("에스프레소"),
        "초코" to listOf("초코", "초콜릿", "초콜렛", "코코아"),
        "에이드" to listOf("에이드"),
        "라떼" to listOf("라떼", "라테"),
        "티" to listOf("티", "차"),
    )
    fun classify(menuName: String): String =
        rules.firstOrNull { (_, names) -> names.any { menuName.contains(it, ignoreCase = true) } }?.first ?: "기타"
}
