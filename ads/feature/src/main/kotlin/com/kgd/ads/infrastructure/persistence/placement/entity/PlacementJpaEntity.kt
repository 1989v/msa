package com.kgd.ads.infrastructure.persistence.placement.entity

import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.AspectRatio
import com.kgd.ads.domain.placement.model.PlacementFormat
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "ad_placement")
class PlacementJpaEntity(
    @Id
    @Column(name = "placement_key", nullable = false, length = 64)
    val placementKey: String,

    @Column(name = "host", nullable = false, length = 128)
    val host: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "format", nullable = false, length = 32)
    val format: PlacementFormat,

    @Column(name = "aspect_ratios", nullable = false, length = 64)
    val aspectRatios: String,

    @Column(name = "floor_micros", nullable = false)
    val floorMicros: Long,

    @Column(name = "active", nullable = false)
    val active: Boolean,

    @Column(name = "paid_allowed", nullable = false)
    val paidAllowed: Boolean,

    @Column(name = "description", nullable = false, length = 255)
    val description: String,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime,
) {
    fun toDomain(): AdPlacement = AdPlacement.of(
        key = placementKey,
        host = host,
        format = format,
        aspectRatios = AspectRatio.parseList(aspectRatios),
        floorMicros = floorMicros,
        active = active,
        paidAllowed = paidAllowed,
        description = description,
    )

    companion object {
        /** 도메인 값 전부를 행으로 — 새 지면이면 [createdAt] = [now], 기존 지면이면 원래 생성 시각을 넘긴다. */
        fun of(placement: AdPlacement, createdAt: LocalDateTime, now: LocalDateTime) = PlacementJpaEntity(
            placementKey = placement.key,
            host = placement.host,
            format = placement.format,
            aspectRatios = placement.aspectRatios.joinToString(",") { it.value },
            floorMicros = placement.floorMicros,
            active = placement.active,
            paidAllowed = placement.paidAllowed,
            description = placement.description,
            createdAt = createdAt,
            updatedAt = now,
        )
    }
}
