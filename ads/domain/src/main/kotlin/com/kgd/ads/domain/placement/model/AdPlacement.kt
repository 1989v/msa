package com.kgd.ads.domain.placement.model

import com.kgd.ads.domain.placement.exception.InvalidPlacementException

/**
 * 지면 — 등록부가 지면의 단일 원본이다. 키는 FE 지면 키와 같은 kebab-case.
 * common 의 `Placement`(노출 위치 계측)와 다른 개념이다.
 *
 * 최저가 하한 1,000 마이크로는 CPM 1회 과금액 `floor(입찰 / 1000)` 이 1 이상이 되게 하는 값이다 —
 * 입찰가 ≥ 최저가가 저장 불변식이므로 이 하한 하나로 0원 노출이 없어진다.
 * `paidAllowed = false` 지면은 HOUSE 만 받는다.
 */
class AdPlacement private constructor(
    val key: String,
    val host: String,
    val format: PlacementFormat,
    val aspectRatios: Set<AspectRatio>,
    floorMicros: Long,
    val active: Boolean,
    val paidAllowed: Boolean,
    val description: String,
) {
    var floorMicros: Long = floorMicros
        private set

    init {
        if (!KEY_PATTERN.matches(key)) throw InvalidPlacementException("지면 키는 kebab-case 여야 합니다: $key")
        if (aspectRatios.isEmpty()) throw InvalidPlacementException("허용 비율이 하나 이상 있어야 합니다")
        requireFloor(floorMicros)
    }

    fun accepts(aspectRatio: AspectRatio): Boolean = aspectRatio in aspectRatios

    fun changeFloor(floorMicros: Long) {
        requireFloor(floorMicros)
        this.floorMicros = floorMicros
    }

    companion object {
        const val MIN_FLOOR_MICROS = 1_000L
        private val KEY_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

        private fun requireFloor(floorMicros: Long) {
            if (floorMicros < MIN_FLOOR_MICROS) {
                throw InvalidPlacementException("지면 최저가는 ${MIN_FLOOR_MICROS} 마이크로 이상이어야 합니다")
            }
        }

        fun of(
            key: String,
            host: String,
            format: PlacementFormat,
            aspectRatios: Set<AspectRatio>,
            floorMicros: Long,
            active: Boolean,
            paidAllowed: Boolean,
            description: String,
        ): AdPlacement = AdPlacement(key, host, format, aspectRatios, floorMicros, active, paidAllowed, description)
    }
}
