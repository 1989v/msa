package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketQueryPort
import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.application.market.port.MarketEditorPort
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
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
    private val restorer: MarketRowRestorer,
) : MarketQueryPort, MarketSavePort, MarketEditorPort {
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
        // Ingestion joins its place transaction and serializes with market editor writes.
        existing?.id?.let { markets.lockById(it) }
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
        return markets.save(MarketJpaEntity.fromDomain(if (existing == null) row else row.copy(
            centerOverrideLat = existing.centerOverrideLat, centerOverrideLng = existing.centerOverrideLng,
            radiusOverrideM = existing.radiusOverrideM))).toDomain()
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

    override fun saveStore(store: MarketStore): MarketStore = saveStoreInternal(store, null)

    override fun saveSourceStore(store: MarketStore, observedSourceKeys: Set<String>): MarketStore {
        require(store.source != MarketStoreSource.MANUAL && store.id == null)
        require(store.sourceKey in observedSourceKeys)
        return saveStoreInternal(store, observedSourceKeys)
    }

    private fun saveStoreInternal(store: MarketStore, observedSourceKeys: Set<String>?): MarketStore {
        validateJson(store.onnuriRaw, store.sanggaRaw, store.goodPriceRaw)
        val natural = if (store.id != null) stores.findById(requireNotNull(store.id)).orElse(null)?.toDomain()
            else store.sourceKey?.let { stores.findByMarketIdAndSourceAndSourceKey(store.marketId, store.source, it)?.toDomain() }
        val sanggaOwner = if (observedSourceKeys != null) store.sanggaKey?.let {
            stores.findByMarketIdAndSanggaKey(store.marketId, it)?.toDomain()
        } else null
        // Two established IDs can each carry editorial overrides. Never delete/merge them or steal UNIQUE ownership.
        val incoming = if (natural != null && sanggaOwner != null && natural.id != sanggaOwner.id)
            store.copy(sanggaKey = natural.sanggaKey) else store
        val existing = natural ?: sanggaOwner ?: if (observedSourceKeys != null) {
                    if (!store.jibunAddress.isNullOrBlank()) {
                            stores.findAllByMarketIdOrderByIdAsc(store.marketId).map { it.toDomain() }.filter {
                                it.source == store.source && it.sourceKey !in observedSourceKeys &&
                                    it.name == store.name && it.jibunAddress == store.jibunAddress
                            }.singleOrNull()
                        } else null
                } else null
        require(existing == null || existing.marketId == store.marketId)
        if (existing == null && store.id != null) {
            require(store.source == MarketStoreSource.MANUAL) { "Only manual stores can be restored" }
            restorer.store(store)
            return store
        }
        require(existing == null || existing.source == store.source || (
            observedSourceKeys != null && existing.source != MarketStoreSource.MANUAL &&
                store.source != MarketStoreSource.MANUAL && store.sanggaKey != null && store.sanggaKey == existing.sanggaKey))
        val row = when {
            existing == null -> store
            store.source == MarketStoreSource.MANUAL -> store.copy(id = existing.id, createdAt = existing.createdAt)
            existing.source == MarketStoreSource.ONNURI && store.source == MarketStoreSource.SANGGA ->
                existing.reloadSource(incoming.copy(source = existing.source, sourceKey = existing.sourceKey,
                    onnuriKey = existing.onnuriKey, onnuriRaw = existing.onnuriRaw, items = existing.items))
            else -> existing.copy(source = incoming.source, sourceKey = incoming.sourceKey,
                onnuriKey = incoming.onnuriKey ?: existing.onnuriKey, onnuriRaw = incoming.onnuriRaw ?: existing.onnuriRaw).reloadSource(incoming)
        }
        // Same ID survives enrichment/source-key migration; override and MANUAL rows are untouched.
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

    override fun findMarket(id: Long): Market? = markets.findById(id).orElse(null)?.toDomain()
    override fun lockMarket(id: Long): Market? = markets.lockById(id)?.toDomain()
    override fun listMarkets(name: String, page: Int, size: Int): Pair<List<Market>, Long> {
        val result = markets.findByNameContainingIgnoreCase(name, PageRequest.of(page, size, Sort.by("id")))
        return result.content.map { it.toDomain() } to result.totalElements
    }
    override fun findChanges(marketId: Long, page: Int, size: Int): Pair<List<MarketChangeLog>, Long> {
        val result = changes.findAllByMarketId(marketId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")))
        return result.content.map { it.toDomain() } to result.totalElements
    }
    override fun findChange(id: Long): MarketChangeLog? = changes.findById(id).orElse(null)?.toDomain()
    override fun saveEditedZone(zone: MarketZone): MarketZone {
        val current = zone.id?.let { zones.findById(it).orElse(null)?.toDomain() }
        require(current == null || (current.marketId == zone.marketId && current.source == zone.source && current.sourceKey == zone.sourceKey))
        if (current == null && zone.id != null) {
            restorer.zone(zone)
            return zone
        }
        return zones.save(MarketZoneJpaEntity.fromDomain(zone)).toDomain()
    }
    override fun deleteZone(id: Long) { zones.deleteById(id) }
    override fun deleteManualStore(id: Long) {
        require(stores.findById(id).orElse(null)?.source == MarketStoreSource.MANUAL)
        stores.deleteById(id)
    }
    override fun replaceOverrides(store: MarketStore, rows: List<MarketStoreOverride>) {
        val id = requireNotNull(store.id)
        require(rows.all { it.storeId == id })
        MarketStoreDisplay.from(store, rows)
        val current = overrides.findAllByStoreIdIn(listOf(id))
        val fields = rows.map { it.field }.toSet()
        overrides.deleteAll(current.filter { it.field !in fields })
        rows.forEach { row ->
            val old = current.find { it.field == row.field }
            if (old == null && row.id != null) restorer.override(row)
            else overrides.save(MarketStoreOverrideJpaEntity.fromDomain(row.copy(id = old?.id)))
        }
    }
}
