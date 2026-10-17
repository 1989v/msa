package com.kgd.place.application.market.port

import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketChangeLog
import com.kgd.place.domain.market.model.MarketSteward
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreOverride
import com.kgd.place.domain.market.model.MarketZone

interface MarketQueryPort {
    fun findMarketByContentId(contentId: String): Market?
    fun findZones(marketId: Long): List<MarketZone>
    fun findStores(marketId: Long): List<MarketStore>
    /** Display-only rows: source payloads are presence markers and must never be saved. */
    fun findStoresForDisplay(marketId: Long): List<MarketStore>
    fun findOverrides(storeIds: List<Long>): List<MarketStoreOverride>
    fun findSteward(marketId: Long, memberId: Long): MarketSteward?
}

/** Deliberately no delete-all / replacement operation: source refreshes retain row identity. */
interface MarketSavePort {
    fun saveMarket(market: Market): Market
    fun saveZone(zone: MarketZone): MarketZone
    fun saveStore(store: MarketStore): MarketStore
    /** Complete current market source-key population; prevents merging distinct current tenants. */
    fun saveSourceStore(store: MarketStore, observedSourceKeys: Set<String>): MarketStore
    fun saveOverride(override: MarketStoreOverride): MarketStoreOverride
    /** One store, distinct fields; validates and writes the effective display atomically. */
    fun saveOverrides(rows: List<MarketStoreOverride>): List<MarketStoreOverride>
    fun appendChange(change: MarketChangeLog): MarketChangeLog
    fun saveSteward(steward: MarketSteward): MarketSteward
    /** ONNURI id → SANGGA id; both rows point at each other and every other store of the market loses its pair. */
    fun savePairs(marketId: Long, pairs: Map<Long, Long>)
}
