package com.kgd.ads.domain.placement.model

import com.kgd.ads.domain.placement.exception.InvalidPlacementException

/**
 * 형태 규격 — 지면이 광고 형태 하나에 대해 받는 허용 비율 목록과 최저가(eCPM, 노출 천 회 기준).
 * 최저가 하한은 지면과 같은 [AdPlacement.MIN_FLOOR_MICROS] 다.
 */
data class FormatSpec(
    val format: PlacementFormat,
    val aspectRatios: Set<AspectRatio>,
    val floorMicros: Long,
) {
    init {
        if (aspectRatios.isEmpty()) throw InvalidPlacementException("허용 비율이 하나 이상 있어야 합니다")
        if (floorMicros < AdPlacement.MIN_FLOOR_MICROS) {
            throw InvalidPlacementException("지면 최저가는 ${AdPlacement.MIN_FLOOR_MICROS} 마이크로 이상이어야 합니다")
        }
    }

    fun accepts(aspectRatio: AspectRatio): Boolean = aspectRatio in aspectRatios

    /** 이미지 가로·세로가 허용 비율 중 하나에 맞는지 — 업로드 검사와 결정이 같은 [AspectRatio.fits] 를 쓴다. */
    fun fits(width: Int, height: Int): Boolean = aspectRatios.any { it.fits(width, height) }
}
