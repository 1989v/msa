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
    private val geometryEdits: com.kgd.place.application.market.port.MarketGeometryEditPort? = null,
    private val tour: com.kgd.place.application.market.port.MarketTourMenuPort? = null) :
    QueryMarketUseCase, SaveMarketUseCase {

    @Transactional(transactionManager = "placeTransactionManager", readOnly = true)
    override fun find(contentId: String, includeOutside: Boolean): QueryMarketUseCase.MarketResult? = find(contentId, includeOutside, "ko")

    @Transactional(transactionManager = "placeTransactionManager", readOnly = true)
    override fun find(contentId: String, includeOutside: Boolean, lang: String): QueryMarketUseCase.MarketResult? {
        require(contentId.isNotBlank())
        val market = query.findMarketByContentId(contentId) ?: return null
        val marketId = requireNotNull(market.id)
        val stores = query.findStoresForDisplay(marketId)
        val overrides = query.findOverrides(stores.mapNotNull { it.id }).groupBy { it.storeId }
        val paths = geometry?.findPaths(marketId).orEmpty()
        val boundary = geometry?.findBoundary(marketId)
        val projected = MarketPublicProjection.stores(stores, overrides, paths.mapNotNull { it.id }.toSet())
        val nearby = MarketPublicProjection.nearby(projected, market, boundary)
        val attached = tour?.attached(marketId).orEmpty()
        val center = MarketPublicProjection.center(market, boundary)
        val bounds = if (boundary != null) {
            com.kgd.place.domain.market.model.MarketCoordinate(boundary.polygon.minOf { it.latitude }, boundary.polygon.minOf { it.longitude }) to
                com.kgd.place.domain.market.model.MarketCoordinate(boundary.polygon.maxOf { it.latitude }, boundary.polygon.maxOf { it.longitude })
        } else center?.let { MarketTourMenuService.bounds(it, 150.0) }
        val attachedIds = attached.values.map { it.attraction.id }.toSet()
        val restaurants = bounds?.let { (sw, ne) -> if (lang == "ko") tour?.restaurants(sw, ne) else tour?.restaurants(sw, ne, lang) }.orEmpty().filter { restaurant ->
            val point = com.kgd.place.domain.market.model.MarketCoordinate(restaurant.latitude, restaurant.longitude)
            (restaurant.koreanAttractionId ?: restaurant.attraction.id) !in attachedIds && if (boundary != null)
                com.kgd.place.domain.market.model.MarketGeometry.contains(point, boundary.polygon)
            else center != null && MarketPublicProjection.distanceMetres(center, point) <= 150
        }
        return QueryMarketUseCase.MarketResult(
            market, query.findZones(marketId), nearby.stores.filter {
                includeOutside || it.display.membership.visibleByDefault || it.display.nearby
            }.map { it.copy(tourMenu = attached[it.source.id]) }, boundary, paths, geometryEdits?.findEntrances(marketId).orEmpty(),
            geometryEdits?.findRawFetchedAt(marketId), nearby.radiusMetres.takeUnless { includeOutside }, restaurants,
        )
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveMarket(market: Market): Market = save.saveMarket(market)

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveZone(zone: MarketZone): MarketZone = save.saveZone(zone)

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveStore(store: MarketStore): MarketStore = save.saveStore(store)
}
