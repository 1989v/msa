package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketZone

interface IngestMarketUseCase {
    fun ingest(command: Command): Result
    data class Command(val market: Market, val zones: List<Zone>, val stores: List<Store>, val observedSourceKeys: List<String> = emptyList())
    data class Zone(val row: MarketZone, val parentKey: String? = null)
    data class Store(val row: MarketStore, val zoneKey: String? = null)
    data class Result(val marketId: Long, val zones: Int, val stores: Int)
}
