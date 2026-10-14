package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.application.market.usecase.IngestMarketUseCase
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketZoneSource
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MarketIngestService(private val save: MarketSavePort) : IngestMarketUseCase {
    @Transactional(transactionManager = "placeTransactionManager")
    override fun ingest(command: IngestMarketUseCase.Command): IngestMarketUseCase.Result {
        require(command.market.id == null)
        require(command.zones.size <= 2000 && command.stores.size <= 2000)
        require(command.zones.all { it.row.id == null && it.row.source == MarketZoneSource.AUTO && it.row.parentId == null })
        require(command.stores.all { it.row.id == null && it.row.source != MarketStoreSource.MANUAL && it.row.zoneId == null })
        require(command.zones.map { it.row.sourceKey }.distinct().size == command.zones.size)
        val observed = command.observedSourceKeys.toSet()
        require(command.stores.all { it.row.sourceKey in observed }) { "Full source-key population is required" }
        val keys = command.zones.mapNotNull { it.row.sourceKey }.toSet()
        require(command.stores.all { it.zoneKey == null || it.zoneKey in keys })
        val orderedKeys = mutableSetOf<String>()
        command.zones.forEach {
            require(it.parentKey == null || it.parentKey in orderedKeys) { "Parent must precede child" }
            orderedKeys.add(requireNotNull(it.row.sourceKey))
        }
        val market = save.saveMarket(command.market)
        val marketId = requireNotNull(market.id)
        val zones = mutableMapOf<String, Long>()
        command.zones.forEach { zone ->
            zones[requireNotNull(zone.row.sourceKey)] = requireNotNull(save.saveZone(zone.row.copy(
                marketId = marketId, parentId = zone.parentKey?.let { zones.getValue(it) },
            )).id)
        }
        command.stores.forEach { store ->
            save.saveSourceStore(store.row.copy(marketId = marketId, zoneId = store.zoneKey?.let { zones.getValue(it) }), observed)
        }
        return IngestMarketUseCase.Result(marketId, zones.size, command.stores.size)
    }
}
