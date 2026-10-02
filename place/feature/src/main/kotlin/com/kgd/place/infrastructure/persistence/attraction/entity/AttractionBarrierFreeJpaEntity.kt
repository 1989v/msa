package com.kgd.place.infrastructure.persistence.attraction.entity

import com.kgd.place.domain.attraction.model.AttractionBarrierFree
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 무장애 여행 정보 한 행. 컬럼 정의는 `V25__create_attraction_barrier_free_and_wellness.sql` 이 SSOT. */
@Entity
@Table(name = "attraction_barrier_free")
class AttractionBarrierFreeJpaEntity(
    @Id
    @Column(name = "attraction_id")
    val attractionId: Long,

    @Column(name = "content_id", nullable = false, length = 32)
    val contentId: String,

    /** 원문은 안을 질의하지 않으므로 문자열로 둔다 (attractions.intro_raw 와 같은 방식). */
    @Column(name = "list_raw", columnDefinition = "json")
    var listRaw: String? = null,

    @Column(name = "detail_raw", columnDefinition = "json")
    var detailRaw: String? = null,

    @Column(name = "list_modified_at")
    var listModifiedAt: LocalDateTime? = null,

    @Column(name = "detail_synced_at")
    var detailSyncedAt: LocalDateTime? = null,

    @Column(length = 255)
    var flags: String? = null,

    @Column(name = "flags_rule_ver")
    var flagsRuleVer: Short? = null,
) {
    fun toDomain() = AttractionBarrierFree(
        attractionId = attractionId,
        contentId = contentId,
        listRaw = listRaw,
        listModifiedAt = listModifiedAt,
        detailRaw = detailRaw,
        detailSyncedAt = detailSyncedAt,
        flags = AttractionBarrierFree.splitFlags(flags),
        flagsRuleVer = flagsRuleVer?.toInt(),
    )
}
