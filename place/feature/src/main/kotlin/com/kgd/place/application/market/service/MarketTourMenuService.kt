package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.MarketTourMenuUseCase
import com.kgd.place.domain.market.model.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import kotlin.math.cos
import kotlin.math.abs

@Service
class MarketTourMenuService(private val query: MarketQueryPort, private val geometry: MarketGeometryQueryPort,
    private val editor: MarketEditorPort, private val tour: MarketTourMenuPort, private val refresh: MarketSearchRefreshPort) : MarketTourMenuUseCase {
    @Transactional(transactionManager = "placeTransactionManager")
    override fun attachAll(): MarketTourMenuUseCase.Summary {
        val results = tour.marketIds().map { attach(it) }
        return MarketTourMenuUseCase.Summary(results.sumOf { it.markets }, results.sumOf { it.matched })
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun attach(marketId: Long): MarketTourMenuUseCase.Summary {
        val market = editor.findMarket(marketId) ?: return MarketTourMenuUseCase.Summary(0, 0)
        val boundary = geometry.findBoundary(marketId)
        val center = MarketPublicProjection.center(market, boundary)
        val stores = query.findStores(marketId)
        val edits = query.findOverrides(stores.mapNotNull { it.id }).groupBy { it.storeId }
        val projected = MarketPublicProjection.stores(stores, edits)
        val candidates = center?.let { c ->
            val bounds = bounds(c, 300.0)
            tour.restaurants(bounds.first, bounds.second).filter {
                MarketPublicProjection.distanceMetres(c, MarketCoordinate(it.latitude, it.longitude)) <= 300
            }
        }.orEmpty()
        val matches = projected.mapNotNull { store ->
            val coordinate = store.display.coordinate ?: return@mapNotNull null
            match(store.display.name, coordinate, candidates)?.let { requireNotNull(store.source.id) to it }
        }.toMap()
        tour.replace(marketId, matches)
        refresh.refresh(marketId)
        return MarketTourMenuUseCase.Summary(1, matches.size)
    }

    companion object {
        fun bounds(center: MarketCoordinate, metres: Double): Pair<MarketCoordinate, MarketCoordinate> {
            val lat = metres / 111320.0
            val lng = lat / cos(Math.toRadians(center.latitude))
            return MarketCoordinate(center.latitude - lat, center.longitude - lng) to
                MarketCoordinate(center.latitude + lat, center.longitude + lng)
        }
        fun match(name: String, coordinate: MarketCoordinate,
            candidates: List<MarketTourMenuUseCase.Restaurant>): MarketTourMenuUseCase.Restaurant? {
            val ranked = candidates.filter { MarketDishDictionary.normalize(it.title) == MarketDishDictionary.normalize(name) }
                .map { it to MarketPublicProjection.distanceMetres(coordinate, MarketCoordinate(it.latitude, it.longitude)) }
                .filter { it.second <= 50.0 }.sortedBy { it.second }
            if (ranked.isEmpty() || (ranked.size > 1 && abs(ranked[0].second - ranked[1].second) < 0.000001)) return null
            return ranked.first().first
        }
    }
}
