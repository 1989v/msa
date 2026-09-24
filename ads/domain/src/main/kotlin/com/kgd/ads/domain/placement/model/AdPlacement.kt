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
    active: Boolean,
    paidAllowed: Boolean,
    description: String,
) {
    var floorMicros: Long = floorMicros
        private set
    var active: Boolean = active
        private set
    var paidAllowed: Boolean = paidAllowed
        private set
    var description: String = description
        private set

    init {
        if (!KEY_PATTERN.matches(key) || key.length > MAX_KEY_LENGTH) throw InvalidPlacementException("지면 키는 ${MAX_KEY_LENGTH}자 이하 kebab-case 여야 합니다: $key")
        if (host.isBlank() || host.length > MAX_HOST_LENGTH) throw InvalidPlacementException("호스트는 1~${MAX_HOST_LENGTH}자여야 합니다")
        if (aspectRatios.isEmpty()) throw InvalidPlacementException("허용 비율이 하나 이상 있어야 합니다")
        requireFloor(floorMicros)
        requireDescription(description)
    }

    fun accepts(aspectRatio: AspectRatio): Boolean = aspectRatio in aspectRatios

    /** 이미지 가로·세로가 허용 비율 중 하나에 맞는지 — 결정의 형식 일치 판정과 같은 [AspectRatio.fits] 를 쓴다. */
    fun fitsImage(width: Int, height: Int): Boolean = aspectRatios.any { it.fits(width, height) }

    fun changeFloor(floorMicros: Long) {
        requireFloor(floorMicros)
        this.floorMicros = floorMicros
    }

    fun changeActive(active: Boolean) {
        this.active = active
    }

    /** 유료를 끄면 이 지면을 타기팅한 유료 캠페인은 결정에서 빠지고, 새로 저장·시작할 수 없다. */
    fun changePaidAllowed(paidAllowed: Boolean) {
        this.paidAllowed = paidAllowed
    }

    fun changeDescription(description: String) {
        requireDescription(description)
        this.description = description
    }

    companion object {
        const val MIN_FLOOR_MICROS = 1_000L
        const val MAX_KEY_LENGTH = 64
        const val MAX_HOST_LENGTH = 128
        const val MAX_DESCRIPTION_LENGTH = 255
        private val KEY_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

        private fun requireFloor(floorMicros: Long) {
            if (floorMicros < MIN_FLOOR_MICROS) {
                throw InvalidPlacementException("지면 최저가는 ${MIN_FLOOR_MICROS} 마이크로 이상이어야 합니다")
            }
        }

        private fun requireDescription(description: String) {
            if (description.isBlank() || description.length > MAX_DESCRIPTION_LENGTH) {
                throw InvalidPlacementException("지면 설명은 1~${MAX_DESCRIPTION_LENGTH}자여야 합니다")
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
