package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.MarketZone
import com.kgd.place.domain.market.model.MarketZoneKind
import com.kgd.place.domain.market.model.MarketZoneSource
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "market_zone")
class MarketZoneJpaEntity(
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val kind: MarketZoneKind,
    @Column(name = "name", nullable = false, length = 300)
    val name: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val source: MarketZoneSource,
    @Column(name = "source_key", nullable = true, length = 191)
    val sourceKey: String?,
    @Column(name = "parent_id", nullable = true)
    val parentId: Long?,
    @Column(name = "road_name", nullable = true, length = 300)
    val roadName: String?,
    @Column(name = "building_name", nullable = true, length = 300)
    val buildingName: String?,
    @Column(name = "dong", nullable = true, length = 100)
    val dong: String?,
    @Column(name = "floor", nullable = true, length = 100)
    val floor: String?,
    @Column(name = "polygon_wkt", nullable = true, columnDefinition = "longtext")
    val polygonWkt: String?,
    @Column(name = "sort_order", nullable = false)
    val sortOrder: Int,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime,
) {
    fun toDomain(): MarketZone = MarketZone(
        marketId = marketId,
        kind = kind,
        name = name,
        source = source,
        sourceKey = sourceKey,
        parentId = parentId,
        roadName = roadName,
        buildingName = buildingName,
        dong = dong,
        floor = floor,
        polygonWkt = polygonWkt,
        sortOrder = sortOrder,
        id = id,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(row: MarketZone): MarketZoneJpaEntity = MarketZoneJpaEntity(
            marketId = row.marketId,
            kind = row.kind,
            name = row.name,
            source = row.source,
            sourceKey = row.sourceKey,
            parentId = row.parentId,
            roadName = row.roadName,
            buildingName = row.buildingName,
            dong = row.dong,
            floor = row.floor,
            polygonWkt = row.polygonWkt,
            sortOrder = row.sortOrder,
            id = row.id,
            createdAt = row.createdAt,
        )
    }
}
