package com.kgd.place.infrastructure.persistence.attraction.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 연관 관광지 한 행 — (시군구, 원천 출발 관광지). 컬럼 정의는 `V29__create_attraction_related.sql` 이 SSOT. */
@Entity
@Table(name = "attraction_related")
class AttractionRelatedJpaEntity(
    @Column(name = "t_ats_cd", nullable = false, length = 64)
    val tAtsCd: String,

    @Column(name = "t_ats_nm", nullable = false, length = 200)
    val tAtsNm: String,

    @Column(name = "signgu_cd", nullable = false, length = 5)
    val signguCd: String,

    @Column(name = "base_ym", nullable = false, length = 6)
    val baseYm: String,

    /** 원문은 안을 질의하지 않으므로 문자열로 둔다 (attractions.intro_raw 와 같은 방식). */
    @Column(name = "related_raw", nullable = false, columnDefinition = "json")
    val relatedRaw: String,

    @Column(name = "attraction_id")
    val attractionId: Long?,

    @Column(name = "match_method", length = 12)
    val matchMethod: String?,

    /** 파생: 대상별 매칭 배열 — 어댑터가 쓰고 읽는다. */
    @Column(name = "targets", columnDefinition = "json")
    val targets: String?,

    @Column(name = "fetched_at", nullable = false)
    val fetchedAt: LocalDateTime,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
