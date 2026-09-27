package com.kgd.ads.application.placement.dto

import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.FormatSpec
import com.kgd.ads.domain.placement.model.PlacementFormat
import java.time.LocalDateTime

/**
 * 지면 한 건. [formats] 가 형태 규격의 원본이다.
 * [format]·[aspectRatios]·[floorMicros] 는 형태 규격 이전 화면을 위한 옛 필드로, 대표 규격(카드가 있으면 카드) 값이다 —
 * 옛 지면 컬럼을 지우는 다음 릴리스에서 함께 뺀다.
 */
data class PlacementView(
    val key: String,
    val host: String,
    val formats: List<FormatSpecView>,
    val active: Boolean,
    val paidAllowed: Boolean,
    val description: String,
    val format: PlacementFormat,
    val aspectRatios: List<String>,
    val floorMicros: Long,
) {
    companion object {
        fun from(placement: AdPlacement): PlacementView {
            val representative = FormatSpecView.from(placement.representative())
            return PlacementView(
                key = placement.key,
                host = placement.host,
                formats = placement.formats.map(FormatSpecView::from),
                active = placement.active,
                paidAllowed = placement.paidAllowed,
                description = placement.description,
                format = representative.format,
                aspectRatios = representative.aspectRatios,
                floorMicros = representative.floorMicros,
            )
        }
    }
}

/** 형태 규격 — 형태·허용 비율·최저가(eCPM, 노출 천 회 기준). */
data class FormatSpecView(val format: PlacementFormat, val aspectRatios: List<String>, val floorMicros: Long) {
    companion object {
        fun from(spec: FormatSpec) = FormatSpecView(spec.format, spec.aspectRatios.map { it.value }.sorted(), spec.floorMicros)
    }
}

/** 등록부에 없는 지면 키로 들어온 요청 — 닫힌 시각만 반영돼 있다. */
data class UnregisteredPlacementView(
    val placementKey: String,
    val requests: Long,
    val firstSeenAt: LocalDateTime,
    val lastSeenAt: LocalDateTime,
)
