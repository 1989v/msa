package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketStoreDisplay
import com.kgd.place.domain.market.model.MarketZone

interface QueryMarketUseCase {
    fun find(contentId: String, includeOutside: Boolean = false): MarketResult?
    fun find(contentId: String, includeOutside: Boolean, lang: String): MarketResult? = find(contentId, includeOutside)
    data class Store(
        val source: MarketStore,
        val display: Display,
        val sources: List<MarketStoreSource> = listOf(source.source),
        val tourMenu: MarketTourMenuUseCase.Menu? = null,
        val nameEn: String = com.kgd.place.application.market.service.KoreanRomanizer.romanize(display.name),
        val categoryEn: String? = null, val itemsEn: String? = null,
    ) {
        constructor(source: MarketStore, display: MarketStoreDisplay,
            sources: List<MarketStoreSource> = listOf(source.source)) : this(source, Display.from(display), sources)
    }
    data class Display(
        val name: String,
        val items: String?,
        val zoneId: Long?,
        val membership: com.kgd.place.domain.market.model.MarketMembership,
        val coordinate: com.kgd.place.domain.market.model.MarketCoordinate?,
        val pinKind: com.kgd.place.domain.market.model.MarketPinKind,
        val nearby: Boolean = false,
    ) {
        companion object {
            fun from(display: MarketStoreDisplay): Display = Display(display.name, display.items, display.zoneId,
                display.membership, display.coordinate, display.pinKind)
        }
    }
    data class MarketResult(val market: Market, val zones: List<MarketZone>, val stores: List<Store>,
        val boundary: com.kgd.place.domain.market.model.MarketBoundary? = null,
        val paths: List<com.kgd.place.domain.market.model.MarketPath> = emptyList(),
        val entrances: List<com.kgd.place.domain.market.model.MarketEntrance> = emptyList(),
        val osmFetchedAt: java.time.LocalDateTime? = null,
        val nearbyRadiusMetres: Int? = null,
        val restaurants: List<MarketTourMenuUseCase.Restaurant> = emptyList())
}

/** Persistence skeleton. HTTP ingest / editing orchestration and authorization arrive in later WUs. */
interface SaveMarketUseCase {
    fun saveMarket(market: Market): Market
    fun saveZone(zone: MarketZone): MarketZone
    fun saveStore(store: MarketStore): MarketStore
}
