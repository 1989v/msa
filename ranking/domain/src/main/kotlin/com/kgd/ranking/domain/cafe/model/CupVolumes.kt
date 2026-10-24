package com.kgd.ranking.domain.cafe.model

import java.math.BigDecimal

enum class VolumeSource { ROW, BRAND_SIZE_TABLE, WEIGHT_ESTIMATE, NONE, ADMIN_VERIFIED }

data class CupVolume(val ml: BigDecimal?, val source: VolumeSource)

/**
 * Cup capacity is separate from source volume/weight. When a brand only publishes grams, 1g≈1ml is
 * stored as WEIGHT_ESTIMATE so the screen can mark the per-100ml value as an estimate.
 */
object CupVolumes {
    private val paikCup = Regex("""컵용량\s*:\s*(\d+(?:\.\d+)?)\s*m(?:l)?(?=\s|$)""", RegexOption.IGNORE_CASE)

    // Official nutrition notice footnote: HOT R355/L473; ICE R414/L473/Max591.
    // https://www.twosome.co.kr/co/annoDetail.do?annoSeqNo=1433
    private const val TWOSOME_HOT_REGULAR_ML = 355
    private const val TWOSOME_ICE_REGULAR_ML = 414
    private const val TWOSOME_LARGE_ML = 473
    private const val TWOSOME_MAX_ML = 591

    // "1회 제공량(g) 310" (dunkin), "총 내용량: 600g" (parisbaguette), "컵용량 : 30g" (ediya); "mg" never matches.
    private val grams = Regex("""\(g\)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*g(?![a-z])""", RegexOption.IGNORE_CASE)

    fun resolve(brandSlug: String, volumeMl: BigDecimal?, servingBasis: String?, sizeLabel: String?, temperature: String?, sourceCategory: String? = null): CupVolume {
        if (volumeMl != null) return CupVolume(volumeMl, VolumeSource.ROW)
        if (brandSlug == "paik") {
            paikCup.find(servingBasis.orEmpty())?.groupValues?.get(1)?.toBigDecimal()?.let {
                if (it.signum() > 0) return CupVolume(it, VolumeSource.ROW)
            }
        }
        val ml = if (brandSlug == "twosome") when (sizeLabel?.trim()?.uppercase()) {
            "L" -> TWOSOME_LARGE_ML
            "M" -> TWOSOME_MAX_ML // Max is an ICE-only size, including rows without a temperature label.
            "R" -> when (temperature?.uppercase()) {
                "HOT" -> TWOSOME_HOT_REGULAR_ML
                "ICE" -> TWOSOME_ICE_REGULAR_ML
                // Frappes are served iced only; the source leaves their temperature blank.
                else -> if (sourceCategory.orEmpty().contains("FRAPPE", ignoreCase = true)) TWOSOME_ICE_REGULAR_ML else null
            }
            else -> null
        } else null
        if (ml != null) return CupVolume(ml.toBigDecimal(), VolumeSource.BRAND_SIZE_TABLE)
        // A basis listing several sizes ("R) 316g, G) 437g …") cannot say which one this row is.
        val weight = grams.findAll(servingBasis.orEmpty()).toList().singleOrNull()?.groupValues?.drop(1)?.firstOrNull { it.isNotEmpty() }?.toBigDecimal()
        return if (weight != null && weight.signum() > 0) CupVolume(weight, VolumeSource.WEIGHT_ESTIMATE) else CupVolume(null, VolumeSource.NONE)
    }
}
