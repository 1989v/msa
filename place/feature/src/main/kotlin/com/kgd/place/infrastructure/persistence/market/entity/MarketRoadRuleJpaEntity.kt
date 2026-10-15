package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.*
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "market_road_rule")
class MarketRoadRuleJpaEntity(
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Column(name = "road_name", nullable = false, length = 300)
    val roadName: String,
    @Column(name = "building_no_from", nullable = true)
    val buildingNoFrom: Int?,
    @Column(name = "building_no_to", nullable = true)
    val buildingNoTo: Int?,
    @Enumerated(EnumType.STRING)
    @Column(name = "membership", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val membership: MarketMembershipStatus,
    @Column(name = "reason", nullable = false, length = 1000)
    val reason: String,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
)
