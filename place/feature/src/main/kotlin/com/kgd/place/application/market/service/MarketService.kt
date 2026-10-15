package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.MarketQueryPort
import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.application.market.usecase.SaveMarketUseCase
import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketZone
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MarketService(private val query: MarketQueryPort, private val save: MarketSavePort,
    private val geometry: com.kgd.place.application.market.port.MarketGeometryQueryPort? = null,
    private val geometryEdits: com.kgd.place.application.market.port.MarketGeometryEditPort? = null) :
    QueryMarketUseCase, SaveMarketUseCase {

    @Transactional(transactionManager = "placeTransactionManager", readOnly = true)
    override fun find(contentId: String, includeOutside: Boolean): QueryMarketUseCase.MarketResult? {
        require(contentId.isNotBlank())
        val market = query.findMarketByContentId(contentId) ?: return null
        val marketId = requireNotNull(market.id)
        val stores = query.findStores(marketId)
        val overrides = query.findOverrides(stores.mapNotNull { it.id }).groupBy { it.storeId }
        val paths = geometry?.findPaths(marketId).orEmpty()
        return QueryMarketUseCase.MarketResult(market, query.findZones(marketId), MarketPublicProjection.stores(stores, overrides, paths.mapNotNull { it.id }.toSet())
            .filter { includeOutside || it.display.membership.visibleByDefault }, geometry?.findBoundary(marketId),
            paths, geometryEdits?.findEntrances(marketId).orEmpty())
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveMarket(market: Market): Market = save.saveMarket(market)

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveZone(zone: MarketZone): MarketZone = save.saveZone(zone)

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveStore(store: MarketStore): MarketStore = save.saveStore(store)
}
