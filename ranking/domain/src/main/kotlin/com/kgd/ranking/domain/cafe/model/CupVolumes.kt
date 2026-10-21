package com.kgd.ranking.domain.cafe.model

import java.math.BigDecimal

enum class VolumeSource { ROW, BRAND_SIZE_TABLE, NONE, ADMIN_VERIFIED }

data class CupVolume(val ml: BigDecimal?, val source: VolumeSource)

/** Cup capacity is separate from source volume/weight; never convert grams to millilitres. */
object CupVolumes {
    private val paikCup = Regex("""컵용량\s*:\s*(\d+(?:\.\d+)?)\s*m(?:l)?(?=\s|$)""", RegexOption.IGNORE_CASE)

    // Official nutrition notice footnote: HOT R355/L473; ICE R414/L473/Max591.
    // https://www.twosome.co.kr/co/annoDetail.do?annoSeqNo=1433
    private const val TWOSOME_HOT_REGULAR_ML = 355
    private const val TWOSOME_ICE_REGULAR_ML = 414
    private const val TWOSOME_LARGE_ML = 473
    private const val TWOSOME_MAX_ML = 591

    fun resolve(brandSlug: String, volumeMl: BigDecimal?, servingBasis: String?, sizeLabel: String?, temperature: String?): CupVolume {
        if (volumeMl != null) return CupVolume(volumeMl, VolumeSource.ROW)
        if (brandSlug == "paik") {
            paikCup.find(servingBasis.orEmpty())?.groupValues?.get(1)?.toBigDecimal()?.let {
                if (it.signum() > 0) return CupVolume(it, VolumeSource.ROW)
            }
        }
        val ml = if (brandSlug == "twosome") when (sizeLabel?.trim()?.uppercase()) {
            "L" -> TWOSOME_LARGE_ML
            "M" -> TWOSOME_MAX_ML // Max is an ICE-only size, including rows without a temperature label.
            "R" -> when (temperature?.uppercase()) { "HOT" -> TWOSOME_HOT_REGULAR_ML; "ICE" -> TWOSOME_ICE_REGULAR_ML; else -> null }
            else -> null
        } else null
        return CupVolume(ml?.toBigDecimal(), if (ml == null) VolumeSource.NONE else VolumeSource.BRAND_SIZE_TABLE)
    }
}
