package com.kgd.place.infrastructure.persistence.attraction.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

/** 관광지 가까운 역·정류장 한 줄. 컬럼 정의는 `V35__transit_stops_and_attraction_access.sql` 이 SSOT. */
@Entity
@Table(name = "attraction_access")
class AttractionAccessJpaEntity(
    @Column(name = "attraction_id", nullable = false) val attractionId: Long,
    @Column(name = "kind", nullable = false, length = 4) val kind: String,
    @Column(name = "stop_rank", nullable = false) val stopRank: Int,
    @Column(name = "source_key", nullable = false, length = 300) val sourceKey: String,
    @Column(name = "name", nullable = false, length = 100) val name: String,
    @Column(name = "name_en", length = 200) val nameEn: String?,
    @Column(name = "line_names", length = 300) val lineNames: String?,
    @Column(name = "distance_m", nullable = false) val distanceM: Int,
    @Column(name = "base_date") val baseDate: LocalDate?,
    @Column(name = "computed_at", nullable = false) val computedAt: LocalDateTime,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
