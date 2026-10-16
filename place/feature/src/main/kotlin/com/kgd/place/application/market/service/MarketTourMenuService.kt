package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.MarketTourMenuUseCase
import com.kgd.place.domain.market.model.*
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.util.concurrent.CompletableFuture
import kotlin.math.cos
import kotlin.math.abs

@Service
class MarketTourMenuService(private val query: MarketQueryPort, private val geometry: MarketGeometryQueryPort,
    private val editor: MarketEditorPort, private val tour: MarketTourMenuPort, private val refresh: MarketSearchRefreshPort,
    @Qualifier("placeTransactionManager") transactionManager: PlatformTransactionManager) : MarketTourMenuUseCase {
    private val log = KotlinLogging.logger {}
    private val transaction = TransactionTemplate(transactionManager)

    /**
     * Runs off the request thread, one transaction per market, and reports the matched count in the log.
     * Done inside one request it held every market's shop rows in the open session and the pod was
     * OOM-killed at 1Gi; the reply therefore carries the market count and matched = 0.
     */
    override fun attachAll(): MarketTourMenuUseCase.Summary {
        val ids = tour.marketIds()
        CompletableFuture.runAsync {
            var matched = 0
            var failed = 0
            ids.forEach { id ->
                try {
                    matched += transaction.execute { attach(id) }?.matched ?: 0
                    // The pod runs at a 1Gi limit; back-to-back markets pushed it to OOM twice.
                    Thread.sleep(PAUSE_BETWEEN_MARKETS_MS)
                } catch (exception: Exception) {
                    failed++
                    log.error(exception) { "Tour menu attach failed: marketId=$id" }
                }
            }
            log.info { "Tour menu attach end: markets=${ids.size}, matched=$matched, failed=$failed" }
        }
        return MarketTourMenuUseCase.Summary(ids.size, 0)
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun attach(marketId: Long): MarketTourMenuUseCase.Summary {
        val market = editor.findMarket(marketId) ?: return MarketTourMenuUseCase.Summary(0, 0)
        val boundary = geometry.findBoundary(marketId)
        val center = MarketPublicProjection.center(market, boundary)
        val candidates = center?.let { c ->
            val bounds = bounds(c, 300.0)
            tour.restaurants(bounds.first, bounds.second).filter {
                MarketPublicProjection.distanceMetres(c, MarketCoordinate(it.latitude, it.longitude)) <= 300
            }
        }.orEmpty()
        // Most markets have no TourAPI restaurant nearby: skip the wide shop rows (a large market
        // carries megabytes of source JSON) and only clear a stale match if one exists.
        if (candidates.isEmpty()) {
            if (tour.attached(marketId).isEmpty()) return MarketTourMenuUseCase.Summary(1, 0)
            tour.replace(marketId, emptyMap())
            refresh.refresh(marketId)
            return MarketTourMenuUseCase.Summary(1, 0)
        }
        val stores = query.findStores(marketId)
        val edits = query.findOverrides(stores.mapNotNull { it.id }).groupBy { it.storeId }
        val projected = MarketPublicProjection.stores(stores, edits)
        val matches = projected.mapNotNull { store ->
            val coordinate = store.display.coordinate ?: return@mapNotNull null
            match(store.display.name, coordinate, candidates)?.let { requireNotNull(store.source.id) to it }
        }.toMap()
        tour.replace(marketId, matches)
        refresh.refresh(marketId)
        return MarketTourMenuUseCase.Summary(1, matches.size)
    }

    companion object {
        const val PAUSE_BETWEEN_MARKETS_MS = 300L
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
