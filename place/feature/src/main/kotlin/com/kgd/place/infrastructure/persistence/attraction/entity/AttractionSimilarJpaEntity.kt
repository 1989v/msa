package com.kgd.place.infrastructure.persistence.attraction.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 비슷한 곳 한 행 (순위 하나). 컬럼 정의는 `V22__create_attraction_similar.sql` 이 SSOT. */
@Entity
@Table(name = "attraction_similar")
class AttractionSimilarJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "attraction_id", nullable = false)
    val attractionId: Long,

    @Column(name = "model_ref", nullable = false, length = 160)
    val modelRef: String,

    @Column(name = "rank_no", nullable = false)
    val rankNo: Short,

    @Column(name = "similar_id", nullable = false)
    val similarId: Long,

    @Column(nullable = false)
    val score: Double,

    @Column(name = "computed_at", nullable = false)
    val computedAt: LocalDateTime,
)
