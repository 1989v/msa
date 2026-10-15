package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketStoreDisplay
import com.kgd.place.domain.market.model.MarketZone

interface QueryMarketUseCase {
    fun find(contentId: String, includeOutside: Boolean = false): MarketResult?
    data class Store(
        val source: MarketStore,
        val display: MarketStoreDisplay,
        val sources: List<MarketStoreSource> = listOf(source.source),
    )
    data class MarketResult(val market: Market, val zones: List<MarketZone>, val stores: List<Store>,
        val boundary: com.kgd.place.domain.market.model.MarketBoundary? = null,
        val paths: List<com.kgd.place.domain.market.model.MarketPath> = emptyList(),
        val entrances: List<com.kgd.place.domain.market.model.MarketEntrance> = emptyList())
}

/** Persistence skeleton. HTTP ingest / editing orchestration and authorization arrive in later WUs. */
interface SaveMarketUseCase {
    fun saveMarket(market: Market): Market
    fun saveZone(zone: MarketZone): MarketZone
    fun saveStore(store: MarketStore): MarketStore
}
