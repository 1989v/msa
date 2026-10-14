package com.kgd.place.domain.market.model

import java.time.LocalDateTime

data class Market(
    val attractionContentId: String,
    val name: String,
    val marketType: MarketType,
    val sourceKey: String? = null,
    val marketInfoMatched: Boolean = false,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val roadAddress: String? = null,
    val jibunAddress: String? = null,
    val sourceMarketType: String? = null,
    val storeCountRaw: String? = null,
    val openingCycle: String? = null,
    val facilities: String? = null,
    val sourceRaw: String? = null,
    val id: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(attractionContentId.isNotBlank() && name.isNotBlank())
        require(!marketInfoMatched || (!sourceKey.isNullOrBlank() && !sourceRaw.isNullOrBlank()))
        require((latitude == null) == (longitude == null))
        if (latitude != null && longitude != null) MarketCoordinate(latitude, longitude)
    }
}
