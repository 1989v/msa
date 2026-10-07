package com.kgd.place.infrastructure.persistence.attraction.entity

import com.kgd.place.domain.attraction.model.GocampingSite
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 고캠핑 캠핑장 한 곳. 컬럼 정의는 `V32__attraction_source_and_gocamping.sql` 이 SSOT. */
@Entity
@Table(name = "gocamping_site")
class GocampingSiteJpaEntity(
    @Id
    @Column(name = "content_id", length = 32)
    val contentId: String,

    @Column(name = "facility_name", nullable = false, length = 200)
    val facilityName: String,

    @Column(name = "manage_status", length = 20)
    val manageStatus: String?,

    val latitude: Double?,

    val longitude: Double?,

    @Column(name = "source_modified_at")
    val sourceModifiedAt: LocalDateTime? = null,

    /** 원문은 안을 질의하지 않으므로 문자열로 둔다 (attraction_related.related_raw 와 같은 방식) */
    @Column(name = "item_raw", nullable = false, columnDefinition = "json")
    val itemRaw: String,

    @Column(name = "matched_attraction_id")
    val matchedAttractionId: Long?,

    @Column(name = "match_method", length = 16)
    val matchMethod: String?,

    @Column(name = "attraction_id")
    val attractionId: Long?,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime,
) {
    fun toDomain() = GocampingSite(
        contentId, facilityName, manageStatus, latitude, longitude, itemRaw, matchedAttractionId, matchMethod, attractionId, syncedAt,
    )

    companion object {
        fun fromDomain(s: GocampingSite) = GocampingSiteJpaEntity(
            contentId = s.contentId, facilityName = s.facilityName, manageStatus = s.manageStatus,
            latitude = s.latitude, longitude = s.longitude, itemRaw = s.itemRaw,
            matchedAttractionId = s.matchedAttractionId, matchMethod = s.matchMethod, attractionId = s.attractionId,
            syncedAt = s.syncedAt,
        )
    }
}
