package com.kgd.place.infrastructure.persistence.transit.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 원천마다 활성 적재 회차 한 행. */
@Entity
@Table(name = "transit_source_run")
class TransitSourceRunJpaEntity(
    @Id
    @Column(name = "source", nullable = false, length = 8)
    val source: String,

    @Column(name = "run_id", nullable = false, length = 32)
    var runId: String,

    @Column(name = "row_count", nullable = false)
    var rowCount: Int,

    @Column(name = "activated_at", nullable = false)
    var activatedAt: LocalDateTime,
)
