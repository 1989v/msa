package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.MarketQueryPort
import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.application.market.usecase.SaveMarketUseCase
import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreDisplay
import com.kgd.place.domain.market.model.MarketZone
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MarketService(private val query: MarketQueryPort, private val save: MarketSavePort) :
    QueryMarketUseCase, SaveMarketUseCase {

    @Transactional(transactionManager = "placeTransactionManager", readOnly = true)
    override fun find(contentId: String, includeOutside: Boolean): QueryMarketUseCase.MarketResult? {
        require(contentId.isNotBlank())
        val market = query.findMarketByContentId(contentId) ?: return null
        val marketId = requireNotNull(market.id)
        val stores = query.findStores(marketId)
        val overrides = query.findOverrides(stores.mapNotNull { it.id }).groupBy { it.storeId }
        return QueryMarketUseCase.MarketResult(market, query.findZones(marketId), stores.map {
            QueryMarketUseCase.Store(it, MarketStoreDisplay.from(it, overrides[it.id].orEmpty()))
        }.filter { includeOutside || it.display.membership.visibleByDefault })
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveMarket(market: Market): Market = save.saveMarket(market)

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveZone(zone: MarketZone): MarketZone = save.saveZone(zone)

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveStore(store: MarketStore): MarketStore = save.saveStore(store)
}
