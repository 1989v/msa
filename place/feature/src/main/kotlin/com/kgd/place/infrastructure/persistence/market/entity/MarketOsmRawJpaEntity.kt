package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.*
import jakarta.persistence.*
import java.time.LocalDateTime

@IdClass(MarketOsmRawId::class)
@Entity
@Table(name = "market_osm_raw")
class MarketOsmRawJpaEntity(
    @Id
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val kind: MarketOsmKind,
    @Column(name = "payload", nullable = false, columnDefinition = "json")
    val payload: String,
    @Column(name = "fetched_at", nullable = false)
    val fetchedAt: LocalDateTime,
)

data class MarketOsmRawId(var marketId: Long = 0, var kind: MarketOsmKind = MarketOsmKind.BOUNDARY) : java.io.Serializable
