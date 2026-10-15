package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.*
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "market_boundary")
class MarketBoundaryJpaEntity(
    @Id
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Column(name = "polygon", nullable = false, columnDefinition = "json")
    val polygon: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val source: MarketGeometrySource,
    @Column(name = "osm_type", nullable = true, length = 20)
    val osmType: String?,
    @Column(name = "osm_id", nullable = true)
    val osmId: Long?,
    @Column(name = "fetched_at", nullable = true)
    val fetchedAt: LocalDateTime?,
)
