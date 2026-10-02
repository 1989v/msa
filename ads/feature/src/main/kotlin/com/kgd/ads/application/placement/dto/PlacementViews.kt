package com.kgd.ads.application.placement.dto

import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.FormatSpec
import com.kgd.ads.domain.placement.model.PlacementFormat
import java.time.LocalDateTime

/** 지면 한 건. [formats] 가 형태별 규격이다. */
data class PlacementView(
    val key: String,
    val host: String,
    val formats: List<FormatSpecView>,
    val active: Boolean,
    val paidAllowed: Boolean,
    val description: String,
) {
    companion object {
        fun from(placement: AdPlacement) = PlacementView(
            key = placement.key,
            host = placement.host,
            formats = placement.formats.map(FormatSpecView::from),
            active = placement.active,
            paidAllowed = placement.paidAllowed,
            description = placement.description,
        )
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
