package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketQueryPort
import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketChangeLog
import com.kgd.place.domain.market.model.MarketSteward
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreDisplay
import com.kgd.place.domain.market.model.MarketStoreOverride
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketZone
import com.kgd.place.domain.market.model.MarketZoneSource
import com.kgd.place.infrastructure.persistence.market.entity.MarketChangeLogJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketStewardJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreOverrideJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketZoneJpaEntity
import com.kgd.place.infrastructure.persistence.market.repository.MarketChangeLogJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketStewardJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketStoreJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketStoreOverrideJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketZoneJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper

@Component
class MarketRepositoryAdapter(
    private val markets: MarketJpaRepository,
    private val zones: MarketZoneJpaRepository,
    private val stores: MarketStoreJpaRepository,
    private val overrides: MarketStoreOverrideJpaRepository,
    private val changes: MarketChangeLogJpaRepository,
    private val stewards: MarketStewardJpaRepository,
) : MarketQueryPort, MarketSavePort {
    private val json = JsonMapper.builder().build()

    private fun validateJson(vararg values: String?) {
        values.filterNotNull().forEach {
            require(json.readTree(it).isObject) { "Source / change payload must be a JSON object" }
        }
    }

    override fun findMarketByContentId(contentId: String): Market? =
        markets.findByAttractionContentId(contentId)?.toDomain()
    override fun findZones(marketId: Long): List<MarketZone> =
        zones.findAllByMarketIdOrderBySortOrderAscIdAsc(marketId).map { it.toDomain() }
    override fun findStores(marketId: Long): List<MarketStore> =
        stores.findAllByMarketIdOrderByIdAsc(marketId).map { it.toDomain() }
    override fun findOverrides(storeIds: List<Long>): List<MarketStoreOverride> =
        if (storeIds.isEmpty()) emptyList() else overrides.findAllByStoreIdIn(storeIds).map { it.toDomain() }
    override fun findSteward(marketId: Long, memberId: Long): MarketSteward? =
        stewards.findByMarketIdAndMemberId(marketId, memberId)?.toDomain()

    override fun saveMarket(market: Market): Market {
        validateJson(market.sourceRaw)
        val existing = markets.findByAttractionContentId(market.attractionContentId)?.toDomain()
        require(market.id == null || market.id == existing?.id)
        val row = when {
            existing == null -> market
            !market.marketInfoMatched && existing.marketInfoMatched -> market.copy(
                id = existing.id, createdAt = existing.createdAt, sourceKey = existing.sourceKey,
                marketInfoMatched = true, sourceRaw = existing.sourceRaw,
                sourceMarketType = existing.sourceMarketType, storeCountRaw = existing.storeCountRaw,
                openingCycle = existing.openingCycle, facilities = existing.facilities,
                roadAddress = existing.roadAddress, jibunAddress = existing.jibunAddress)
            else -> market.copy(id = existing.id, createdAt = existing.createdAt)
        }
        return markets.save(MarketJpaEntity.fromDomain(row)).toDomain()
    }

    override fun saveZone(zone: MarketZone): MarketZone {
        val existing = if (zone.id != null) zones.findById(requireNotNull(zone.id)).orElse(null)?.toDomain()
            else zone.sourceKey?.let { zones.findByMarketIdAndSourceAndSourceKey(zone.marketId, zone.source, it)?.toDomain() }
        require(existing == null || (existing.marketId == zone.marketId && existing.source == zone.source))
        // Automatic reruns retain editorial names, ordering and polygons, including all MANUAL rows.
        if (existing != null && zone.source == MarketZoneSource.AUTO) {
            val refreshed = zone.copy(id = existing.id, createdAt = existing.createdAt,
                name = existing.name, polygonWkt = existing.polygonWkt, sortOrder = existing.sortOrder)
            return zones.save(MarketZoneJpaEntity.fromDomain(refreshed)).toDomain()
        }
        val row = if (existing == null) zone else zone.copy(id = existing.id, createdAt = existing.createdAt)
        return zones.save(MarketZoneJpaEntity.fromDomain(row)).toDomain()
    }

    override fun saveStore(store: MarketStore): MarketStore {
        validateJson(store.onnuriRaw, store.sanggaRaw)
        val existing = if (store.id != null) stores.findById(requireNotNull(store.id)).orElse(null)?.toDomain()
            else store.sourceKey?.let { stores.findByMarketIdAndSourceAndSourceKey(store.marketId, store.source, it)?.toDomain() }
        require(existing == null || (existing.marketId == store.marketId && existing.source == store.source && existing.sourceKey == store.sourceKey))
        val row = when {
            existing == null -> store
            store.source == MarketStoreSource.MANUAL -> store.copy(id = existing.id, createdAt = existing.createdAt)
            else -> existing.reloadSource(store)
        }
        // No operation on override / MANUAL tables in the automatic source path.
        return stores.save(MarketStoreJpaEntity.fromDomain(row)).toDomain()
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveOverride(override: MarketStoreOverride): MarketStoreOverride =
        saveOverrides(listOf(override)).single()

    @Transactional(transactionManager = "placeTransactionManager")
    override fun saveOverrides(rows: List<MarketStoreOverride>): List<MarketStoreOverride> {
        require(rows.isNotEmpty() && rows.map { it.storeId }.distinct().size == 1)
        require(rows.map { it.field }.distinct().size == rows.size)
        val storeId = rows.first().storeId
        val store = requireNotNull(stores.findById(storeId).orElse(null)) { "Store not found" }.toDomain()
        val current = overrides.findAllByStoreIdIn(listOf(storeId))
        val byField = current.associateBy { it.field }
        rows.forEach { require(it.id == null || it.id == byField[it.field]?.id) }
        val changedFields = rows.map { it.field }.toSet()
        MarketStoreDisplay.from(store, current.filter { it.field !in changedFields }.map { it.toDomain() } + rows)
        return overrides.saveAll(rows.map {
            MarketStoreOverrideJpaEntity.fromDomain(it.copy(id = byField[it.field]?.id))
        }).map { it.toDomain() }
    }
    override fun appendChange(change: MarketChangeLog): MarketChangeLog {
        require(change.id == null) { "Change history is append-only" }
        validateJson(change.beforeRaw, change.afterRaw)
        return changes.save(MarketChangeLogJpaEntity.fromDomain(change)).toDomain()
    }
    override fun saveSteward(steward: MarketSteward): MarketSteward {
        val existing = stewards.findByMarketIdAndMemberId(steward.marketId, steward.memberId)
        require(steward.id == null || steward.id == existing?.id)
        val row = if (existing == null) steward else steward.copy(id = existing.id, createdAt = existing.createdAt)
        return stewards.save(MarketStewardJpaEntity.fromDomain(row)).toDomain()
    }
}
