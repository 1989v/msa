package com.kgd.place.application.market.port

import com.kgd.place.domain.market.model.*

interface MarketGeometryRequestPort {
    fun save(request: MarketGeometryRequest): MarketGeometryRequest
    fun lockById(id: Long): MarketGeometryRequest?
    fun listForMarket(marketId: Long): List<MarketGeometryRequest>
    fun list(status: GeometryRequestStatus?): List<MarketGeometryRequest>
}
