package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.*
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "market_path")
class MarketPathJpaEntity(
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Column(name = "name", nullable = true, length = 300)
    val name: String?,
    @Column(name = "named", nullable = false)
    val named: Boolean,
    @Column(name = "geometry", nullable = false, columnDefinition = "json")
    val geometry: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val source: MarketGeometrySource,
    @Column(name = "osm_way_id", nullable = true)
    val osmWayId: Long?,
    @Column(name = "sort_order", nullable = false)
    val sort: Int,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
)
