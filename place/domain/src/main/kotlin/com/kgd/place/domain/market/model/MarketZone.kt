package com.kgd.place.domain.market.model

import java.time.LocalDateTime

data class MarketZone(
    val marketId: Long,
    val kind: MarketZoneKind,
    val name: String,
    val source: MarketZoneSource,
    val sourceKey: String? = null,
    val parentId: Long? = null,
    val roadName: String? = null,
    val buildingName: String? = null,
    val dong: String? = null,
    val floor: String? = null,
    val polygonWkt: String? = null,
    val sortOrder: Int = 0,
    val id: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(marketId > 0 && name.isNotBlank())
        require(source != MarketZoneSource.AUTO || !sourceKey.isNullOrBlank())
        require(parentId != id || id == null)
    }
}
