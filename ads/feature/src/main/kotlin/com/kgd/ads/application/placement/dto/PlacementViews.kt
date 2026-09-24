package com.kgd.ads.application.placement.dto

import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.PlacementFormat
import java.time.LocalDateTime

data class PlacementView(
    val key: String,
    val host: String,
    val format: PlacementFormat,
    val aspectRatios: List<String>,
    val floorMicros: Long,
    val active: Boolean,
    val paidAllowed: Boolean,
    val description: String,
) {
    companion object {
        fun from(placement: AdPlacement) = PlacementView(
            key = placement.key,
            host = placement.host,
            format = placement.format,
            aspectRatios = placement.aspectRatios.map { it.value }.sorted(),
            floorMicros = placement.floorMicros,
            active = placement.active,
            paidAllowed = placement.paidAllowed,
            description = placement.description,
        )
    }
}

/** 등록부에 없는 지면 키로 들어온 요청 — 닫힌 시각만 반영돼 있다. */
data class UnregisteredPlacementView(
    val placementKey: String,
    val requests: Long,
    val firstSeenAt: LocalDateTime,
    val lastSeenAt: LocalDateTime,
)
