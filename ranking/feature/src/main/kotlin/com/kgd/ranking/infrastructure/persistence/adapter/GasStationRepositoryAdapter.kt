package com.kgd.ranking.infrastructure.persistence.adapter

import com.kgd.ranking.application.gas.port.GasStationRepositoryPort
import com.kgd.ranking.domain.model.GasStation
import com.kgd.ranking.infrastructure.persistence.entity.GasStationJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.GasStationPriceJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.GasStationJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.GasStationPriceJpaRepository
import org.springframework.stereotype.Component

/**
 * 주유소는 본체와 유종별 가격 두 테이블에 걸쳐 있다. 도메인은 [GasStation.prices] 로 한 덩어리를 보고,
 * 여기서 둘로 나눈다. [saveAll] 은 전체 동기화 — 넘어오지 않은 유종의 가격 행은 지운다.
 */
@Component
class GasStationRepositoryAdapter(
    private val stationRepository: GasStationJpaRepository,
    private val priceRepository: GasStationPriceJpaRepository,
) : GasStationRepositoryPort {

    override fun findAll(): List<GasStation> = withPrices(stationRepository.findAll())

    override fun findByOpinetIdIn(opinetIds: Collection<String>): List<GasStation> =
        withPrices(stationRepository.findByOpinetIdIn(opinetIds))

    override fun saveAll(stations: List<GasStation>): List<GasStation> {
        if (stations.isEmpty()) return emptyList()

        val existing = stationRepository.findByOpinetIdIn(stations.map { it.opinetId }).associateBy { it.opinetId }
        val saved = stations.map { station ->
            val incoming = GasStationJpaEntity.fromDomain(station)
            val current = existing[station.opinetId]
            if (current == null) {
                stationRepository.save(incoming)
            } else {
                current.syncFrom(incoming)
                current
            }
        }
        syncPrices(saved.zip(stations))
        return withPrices(saved)
    }

    private fun syncPrices(pairs: List<Pair<GasStationJpaEntity, GasStation>>) {
        val stationIds = pairs.mapNotNull { it.first.id }
        if (stationIds.isEmpty()) return

        val currentByStation = priceRepository.findByStationIdIn(stationIds).groupBy { it.stationId }
        val toDelete = mutableListOf<GasStationPriceJpaEntity>()
        val toSave = mutableListOf<GasStationPriceJpaEntity>()

        pairs.forEach { (entity, station) ->
            val stationId = entity.id ?: return@forEach
            val current = currentByStation[stationId].orEmpty().associateBy { it.productCode }
            val incomingCodes = station.prices.map { it.productCode }.toSet()

            station.prices.forEach { price ->
                val row = current[price.productCode]
                if (row == null) {
                    toSave += GasStationPriceJpaEntity(
                        stationId = stationId,
                        productCode = price.productCode,
                        price = price.price,
                        tradedAt = price.tradedAt,
                        updatedAt = station.syncedAt,
                    )
                } else {
                    row.update(price.price, price.tradedAt, station.syncedAt)
                }
            }
            // 이번에 안 온 유종은 더 이상 팔지 않는 것으로 본다 — 어제 가격이 남으면 안 된다
            toDelete += current.filterKeys { it !in incomingCodes }.values
        }

        if (toDelete.isNotEmpty()) priceRepository.deleteAll(toDelete)
        if (toSave.isNotEmpty()) priceRepository.saveAll(toSave)
    }

    private fun withPrices(entities: List<GasStationJpaEntity>): List<GasStation> {
        if (entities.isEmpty()) return emptyList()
        val pricesByStation = priceRepository.findByStationIdIn(entities.mapNotNull { it.id }).groupBy { it.stationId }
        return entities.map { it.toDomain(pricesByStation[it.id].orEmpty()) }
    }
}
