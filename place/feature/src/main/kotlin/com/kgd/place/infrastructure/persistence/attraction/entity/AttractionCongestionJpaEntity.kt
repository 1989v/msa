package com.kgd.place.infrastructure.persistence.attraction.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

/** 관광지 집중률 한 행 — (시군구, 원천 관광지 이름). 컬럼 정의는 `V28__create_attraction_congestion.sql` 이 SSOT. */
@Entity
@Table(name = "attraction_congestion")
class AttractionCongestionJpaEntity(
    @Column(name = "signgu_cd", nullable = false, length = 5)
    val signguCd: String,

    @Column(name = "t_ats_nm", nullable = false, length = 200)
    val tAtsNm: String,

    @Column(name = "area_cd", nullable = false, length = 2)
    val areaCd: String,

    @Column(name = "area_nm", length = 40)
    val areaNm: String?,

    @Column(name = "signgu_nm", length = 40)
    val signguNm: String?,

    /** 원문은 안을 질의하지 않으므로 문자열로 둔다 (attractions.intro_raw 와 같은 방식). */
    @Column(name = "rates_raw", nullable = false, columnDefinition = "json")
    val ratesRaw: String,

    @Column(name = "first_ymd", nullable = false)
    val firstYmd: LocalDate,

    @Column(name = "last_ymd", nullable = false)
    val lastYmd: LocalDate,

    @Column(name = "attraction_id")
    val attractionId: Long?,

    @Column(name = "match_method", length = 12)
    val matchMethod: String?,

    @Column(name = "fetched_at", nullable = false)
    val fetchedAt: LocalDateTime,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
