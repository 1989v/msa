package com.kgd.ads.domain.placement.model

import com.kgd.ads.domain.placement.exception.InvalidPlacementException

/**
 * 지면 — 등록부가 지면의 단일 원본이다. 키는 FE 지면 키와 같은 kebab-case.
 * common 의 `Placement`(노출 위치 계측)와 다른 개념이다.
 *
 * 허용 비율과 최저가는 광고 형태마다 따로 갖는다([formats], 형태당 하나·최소 하나). 비율 판정과 최저가는
 * 형태를 받아 그 규격으로만 판단한다 — 두 형태를 받는 지면이라도 한 형태의 캠페인은 자기 형태 규격만 본다.
 *
 * 최저가 하한 1,000 마이크로는 CPM 1회 과금액 `floor(입찰 / 1000)` 이 1 이상이 되게 하는 값이다 —
 * 입찰가 ≥ 최저가가 저장 불변식이므로 이 하한 하나로 0원 노출이 없어진다.
 * `paidAllowed = false` 지면은 HOUSE 만 받는다.
 */
class AdPlacement private constructor(
    val key: String,
    val host: String,
    formats: List<FormatSpec>,
    active: Boolean,
    paidAllowed: Boolean,
    description: String,
) {
    /** 형태 순서(카드 → 띠배너)로 정렬돼 있다. */
    var formats: List<FormatSpec> = sorted(formats)
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
        requireFormats(formats)
        requireDescription(description)
    }

    /** 그 형태의 규격. 없으면 이 지면은 그 형태를 받지 않는다. */
    fun spec(format: PlacementFormat): FormatSpec? = formats.firstOrNull { it.format == format }

    fun accepts(format: PlacementFormat, aspectRatio: AspectRatio): Boolean = spec(format)?.accepts(aspectRatio) == true

    /** 이미지가 그 형태 규격의 허용 비율 중 하나에 맞는지. 규격이 없으면 false. */
    fun fitsImage(format: PlacementFormat, width: Int, height: Int): Boolean = spec(format)?.fits(width, height) == true

    /** 이미지가 어느 규격에든 맞는지 — 형태가 없는 HOUSE 소재의 판정. */
    fun fitsAnyFormat(width: Int, height: Int): Boolean = formats.any { it.fits(width, height) }

    fun addFormat(spec: FormatSpec) {
        if (spec(spec.format) != null) throw InvalidPlacementException("지면 $key 에 이미 ${spec.format.label} 규격이 있습니다")
        formats = sorted(formats + spec)
    }

    /**
     * 그 형태의 최저가를 바꾼다. 올리면 입찰가가 미달인 그 형태의 캠페인은 결정에서 빠지고 시작·재개가 거절된다.
     */
    fun changeFloor(format: PlacementFormat, floorMicros: Long) {
        val current = requireSpec(format)
        val changed = current.copy(floorMicros = floorMicros)
        formats = formats.map { if (it.format == format) changed else it }
    }

    /**
     * 그 형태 규격을 지운다. 그 형태의 유료 캠페인은 이 지면 결정에서 빠지고 시작·재개가 거절된다(최저가 인상과 같은 효과).
     * 마지막 규격은 지울 수 없다.
     */
    fun removeFormat(format: PlacementFormat) {
        requireSpec(format)
        if (formats.size == 1) throw InvalidPlacementException("지면 $key 의 마지막 형태 규격은 지울 수 없습니다")
        formats = formats.filter { it.format != format }
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

    private fun requireSpec(format: PlacementFormat): FormatSpec =
        spec(format) ?: throw InvalidPlacementException("지면 $key 에 ${format.label} 규격이 없습니다")

    companion object {
        const val MIN_FLOOR_MICROS = 1_000L
        const val MAX_KEY_LENGTH = 64
        const val MAX_HOST_LENGTH = 128
        const val MAX_DESCRIPTION_LENGTH = 255
        private val KEY_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

        private fun sorted(formats: List<FormatSpec>): List<FormatSpec> = formats.sortedBy { it.format.ordinal }

        private fun requireFormats(formats: List<FormatSpec>) {
            if (formats.isEmpty()) throw InvalidPlacementException("형태 규격이 하나 이상 있어야 합니다")
            if (formats.map { it.format }.toSet().size != formats.size) throw InvalidPlacementException("형태 규격은 형태마다 하나입니다")
        }

        private fun requireDescription(description: String) {
            if (description.isBlank() || description.length > MAX_DESCRIPTION_LENGTH) {
                throw InvalidPlacementException("지면 설명은 1~${MAX_DESCRIPTION_LENGTH}자여야 합니다")
            }
        }

        fun of(
            key: String,
            host: String,
            formats: List<FormatSpec>,
            active: Boolean,
            paidAllowed: Boolean,
            description: String,
        ): AdPlacement = AdPlacement(key, host, formats, active, paidAllowed, description)
    }
}
