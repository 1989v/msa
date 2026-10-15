package com.kgd.place.application.market.port

import com.kgd.place.domain.market.model.*

interface MarketGeometryEditPort {
    fun findEntrances(marketId: Long): List<MarketEntrance>
    fun findRaw(marketId: Long, kind: MarketOsmKind): MarketOsmRaw?
    fun saveRaw(raw: MarketOsmRaw)
    fun boundary(marketId: Long, value: MarketBoundary?)
    fun path(marketId: Long, id: Long?, value: MarketPath?): MarketPath?
    fun entrance(marketId: Long, id: Long?, value: MarketEntrance?): MarketEntrance?
    fun roadRule(marketId: Long, id: Long?, value: MarketRoadRule?): MarketRoadRule?
    fun geo(marketId: Long, lat: Double?, lng: Double?, radius: Double?)
}
