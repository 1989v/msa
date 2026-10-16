package com.kgd.place.application.market.port

import com.kgd.place.application.market.usecase.MarketTourMenuUseCase.*
import com.kgd.place.domain.market.model.MarketCoordinate

interface MarketTourMenuPort {
    fun marketIds(): List<Long>
    fun restaurants(southWest: MarketCoordinate, northEast: MarketCoordinate): List<Restaurant>
    fun attached(marketId: Long): Map<Long, Menu>
    /** Replace every derived attachment, clearing stale name/coordinate matches. */
    fun replace(marketId: Long, matches: Map<Long, Restaurant>)
}
