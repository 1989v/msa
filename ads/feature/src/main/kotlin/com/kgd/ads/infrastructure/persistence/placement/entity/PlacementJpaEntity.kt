package com.kgd.ads.infrastructure.persistence.placement.entity

import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.FormatSpec
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/**
 * 지면 행. 형태 규격은 [PlacementFormatJpaEntity] 가 따로 갖는다.
 *
 * 표에 남은 옛 컬럼 `format`·`aspect_ratios`·`floor_micros` 는 매핑하지 않는다 — NULL 허용(V5)이라 새 행에는 NULL 이 들어가고,
 * 다음 마이그레이션에서 지운다.
 */
@Entity
@Table(name = "ad_placement")
class PlacementJpaEntity(
    @Id
    @Column(name = "placement_key", nullable = false, length = 64)
    val placementKey: String,

    @Column(name = "host", nullable = false, length = 128)
    val host: String,

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
    fun toDomain(formats: List<FormatSpec>): AdPlacement = AdPlacement.of(
        key = placementKey,
        host = host,
        formats = formats,
        active = active,
        paidAllowed = paidAllowed,
        description = description,
    )

    companion object {
        /**
         * 도메인 값 전부를 행으로(형태 규격 제외) — 새 지면이면 [createdAt] = [now],
         * 기존 지면이면 원래 생성 시각을 넘긴다.
         */
        fun of(placement: AdPlacement, createdAt: LocalDateTime, now: LocalDateTime) = PlacementJpaEntity(
            placementKey = placement.key,
            host = placement.host,
            active = placement.active,
            paidAllowed = placement.paidAllowed,
            description = placement.description,
            createdAt = createdAt,
            updatedAt = now,
        )
    }
}
