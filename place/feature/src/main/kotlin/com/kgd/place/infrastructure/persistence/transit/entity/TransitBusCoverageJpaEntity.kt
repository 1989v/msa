package com.kgd.place.infrastructure.persistence.transit.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 시군구 버스 원천 연계 판정 한 행. */
@Entity
@Table(name = "transit_bus_coverage")
class TransitBusCoverageJpaEntity(
    @Id
    @Column(name = "sigungu_code", nullable = false, length = 5)
    val sigunguCode: String,

    @Column(name = "stops", nullable = false)
    val stops: Int,

    @Column(name = "covered", nullable = false)
    val covered: Boolean,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime,
)
