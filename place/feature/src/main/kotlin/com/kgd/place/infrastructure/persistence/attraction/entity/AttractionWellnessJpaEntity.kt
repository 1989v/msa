package com.kgd.place.infrastructure.persistence.attraction.entity

import com.kgd.place.domain.attraction.model.AttractionWellness
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 웰니스 테마 태그 한 행. 컬럼 정의는 `V25__create_attraction_barrier_free_and_wellness.sql` 이 SSOT. */
@Entity
@Table(name = "attraction_wellness")
class AttractionWellnessJpaEntity(
    @Id
    @Column(name = "attraction_id")
    val attractionId: Long,

    @Column(name = "content_id", nullable = false, length = 32)
    val contentId: String,

    @Column(nullable = false, length = 8)
    val lang: String,

    @Column(name = "thema_cd", nullable = false, length = 16)
    val themaCd: String,

    @Column(name = "list_raw", nullable = false, columnDefinition = "json")
    val listRaw: String,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime,
) {
    fun toDomain() = AttractionWellness(attractionId, contentId, lang, themaCd, listRaw)
}
