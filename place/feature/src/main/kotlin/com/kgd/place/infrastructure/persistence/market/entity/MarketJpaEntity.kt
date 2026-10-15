package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketType
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
@Table(name = "market")
class MarketJpaEntity(
    @Column(name = "attraction_content_id", nullable = false, length = 40)
    val attractionContentId: String,
    @Column(name = "name", nullable = false, length = 300)
    val name: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "market_type", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val marketType: MarketType,
    @Column(name = "source_key", nullable = true, length = 191)
    val sourceKey: String?,
    @Column(name = "market_info_matched", nullable = false)
    val marketInfoMatched: Boolean,
    @Column(name = "latitude", nullable = true)
    val latitude: Double?,
    @Column(name = "longitude", nullable = true)
    val longitude: Double?,
    @Column(name = "road_address", nullable = true, length = 500)
    val roadAddress: String?,
    @Column(name = "jibun_address", nullable = true, length = 500)
    val jibunAddress: String?,
    @Column(name = "source_market_type", nullable = true, length = 100)
    val sourceMarketType: String?,
    @Column(name = "store_count_raw", nullable = true, length = 100)
    val storeCountRaw: String?,
    @Column(name = "opening_cycle", nullable = true, length = 300)
    val openingCycle: String?,
    @Column(name = "facilities", nullable = true, columnDefinition = "text")
    val facilities: String?,
    @Column(name = "source_raw", nullable = true, columnDefinition = "json")
    val sourceRaw: String?,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime,
    @Column(name = "center_override_lat", nullable = true)
    val centerOverrideLat: Double? = null,
    @Column(name = "center_override_lng", nullable = true)
    val centerOverrideLng: Double? = null,
    @Column(name = "radius_override_m", nullable = true)
    val radiusOverrideM: Double? = null,
) {
    fun toDomain(): Market = Market(
        attractionContentId = attractionContentId,
        name = name,
        marketType = marketType,
        sourceKey = sourceKey,
        marketInfoMatched = marketInfoMatched,
        latitude = latitude,
        longitude = longitude,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
        sourceMarketType = sourceMarketType,
        storeCountRaw = storeCountRaw,
        openingCycle = openingCycle,
        facilities = facilities,
        sourceRaw = sourceRaw,
        id = id,
        createdAt = createdAt,
        centerOverrideLat = centerOverrideLat,
        centerOverrideLng = centerOverrideLng,
        radiusOverrideM = radiusOverrideM,

    )

    companion object {
        fun fromDomain(row: Market): MarketJpaEntity = MarketJpaEntity(
            attractionContentId = row.attractionContentId,
            name = row.name,
            marketType = row.marketType,
            sourceKey = row.sourceKey,
            marketInfoMatched = row.marketInfoMatched,
            latitude = row.latitude,
            longitude = row.longitude,
            roadAddress = row.roadAddress,
            jibunAddress = row.jibunAddress,
            sourceMarketType = row.sourceMarketType,
            storeCountRaw = row.storeCountRaw,
            openingCycle = row.openingCycle,
            facilities = row.facilities,
            sourceRaw = row.sourceRaw,
            id = row.id,
            createdAt = row.createdAt,
            centerOverrideLat = row.centerOverrideLat,
            centerOverrideLng = row.centerOverrideLng,
            radiusOverrideM = row.radiusOverrideM,

        )
    }
}
