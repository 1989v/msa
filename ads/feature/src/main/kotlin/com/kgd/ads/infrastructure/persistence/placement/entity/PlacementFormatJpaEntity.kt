package com.kgd.ads.infrastructure.persistence.placement.entity

import com.kgd.ads.domain.placement.model.AspectRatio
import com.kgd.ads.domain.placement.model.FormatSpec
import com.kgd.ads.domain.placement.model.PlacementFormat
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable

/** 지면의 형태 규격 한 행 — (지면, 형태)마다 하나. */
@Entity
@Table(name = "ad_placement_format")
@IdClass(PlacementFormatJpaEntity.Key::class)
class PlacementFormatJpaEntity(
    @Id
    @Column(name = "placement_key", nullable = false, length = 64)
    val placementKey: String,

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "format", nullable = false, length = 16)
    val format: PlacementFormat,

    @Column(name = "aspect_ratios", nullable = false, length = 64)
    val aspectRatios: String,

    @Column(name = "floor_micros", nullable = false)
    val floorMicros: Long,
) {
    fun toDomain(): FormatSpec = FormatSpec(format, AspectRatio.parseList(aspectRatios), floorMicros)

    data class Key(val placementKey: String = "", val format: PlacementFormat = PlacementFormat.CARD) : Serializable

    companion object {
        fun of(placementKey: String, spec: FormatSpec) = PlacementFormatJpaEntity(
            placementKey = placementKey,
            format = spec.format,
            aspectRatios = joinRatios(spec.aspectRatios),
            floorMicros = spec.floorMicros,
        )

        /** 저장 형식 `1.91:1,1:1` — [AspectRatio.parseList] 의 반대. */
        fun joinRatios(ratios: Set<AspectRatio>): String = ratios.joinToString(",") { it.value }
    }
}
