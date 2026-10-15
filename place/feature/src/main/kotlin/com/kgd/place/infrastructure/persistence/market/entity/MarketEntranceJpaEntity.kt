package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.*
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "market_entrance")
class MarketEntranceJpaEntity(
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Column(name = "lat", nullable = false)
    val latitude: Double,
    @Column(name = "lng", nullable = false)
    val longitude: Double,
    @Column(name = "via_path_id", nullable = true)
    val viaPathId: Long?,
    @Column(name = "label", nullable = true, length = 300)
    val label: String?,
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val source: MarketGeometrySource,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
)
