package com.kgd.place.application.market.port

import com.kgd.place.domain.market.model.*

interface MarketEditorPort {
    fun findMarket(id: Long): Market?
    fun lockMarket(id: Long): Market?
    fun listMarkets(name: String, page: Int, size: Int): Pair<List<Market>, Long>
    fun findChanges(marketId: Long, page: Int, size: Int): Pair<List<MarketChangeLog>, Long>
    fun findChange(id: Long): MarketChangeLog?
    fun saveEditedZone(zone: MarketZone): MarketZone
    fun deleteZone(id: Long)
    fun deleteManualStore(id: Long)
    fun replaceOverrides(store: MarketStore, rows: List<MarketStoreOverride>)
}
