package com.kgd.ranking.application.service

import com.kgd.ranking.application.dto.GasStationBulkResult
import com.kgd.ranking.application.dto.GasStationUpsertItem
import com.kgd.ranking.infrastructure.persistence.entity.GasStationJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.GasStationPriceJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.GasStationJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.GasStationPriceJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

private val logger = KotlinLogging.logger {}

/**
 * 수집기가 보낸 주유소를 적재한다 (ADR-0081 §3).
 *
 * **전체 동기화다.** 요청에 없는 필드는 지워지고, 요청에 없는 유종의 가격 행도 지워진다 —
 * 주유소가 경유 취급을 그만두면 어제 가격이 남아 있으면 안 되기 때문이다. 그래서 수집기는
 * 유종별로 나눠 보내지 않고 **주유소 단위로 유종을 모아** 한 번에 보낸다.
 */
@Service
class GasStationSyncService(
    private val stationRepository: GasStationJpaRepository,
    private val priceRepository: GasStationPriceJpaRepository,
) {

    @Transactional
    fun upsert(items: List<GasStationUpsertItem>): GasStationBulkResult {
        if (items.isEmpty()) return GasStationBulkResult(0, 0, 0)

        val now = Instant.now()
        val existing = stationRepository.findByOpinetIdIn(items.map { it.opinetId })
            .associateBy { it.opinetId }

        var created = 0
        var updated = 0
        val saved = items.map { item ->
            val incoming = item.toEntity(now)
            val current = existing[item.opinetId]
            if (current == null) {
                created++
                stationRepository.save(incoming)
            } else {
                updated++
                current.syncFrom(incoming)
                current
            }
        }

        syncPrices(saved.zip(items), now)

        logger.info { "[GAS] 주유소 적재 ${items.size}건 (신규 $created · 갱신 $updated)" }
        return GasStationBulkResult(received = items.size, created = created, updated = updated)
    }

    private fun syncPrices(pairs: List<Pair<GasStationJpaEntity, GasStationUpsertItem>>, now: Instant) {
        val stationIds = pairs.mapNotNull { it.first.id }
        if (stationIds.isEmpty()) return

        val currentByStation = priceRepository.findByStationIdIn(stationIds).groupBy { it.stationId }
        val toDelete = mutableListOf<GasStationPriceJpaEntity>()
        val toSave = mutableListOf<GasStationPriceJpaEntity>()

        pairs.forEach { (station, item) ->
            val stationId = station.id ?: return@forEach
            val current = currentByStation[stationId].orEmpty().associateBy { it.productCode }
            val incomingCodes = item.prices.map { it.productCode }.toSet()

            item.prices.forEach { price ->
                val row = current[price.productCode]
                if (row == null) {
                    toSave += GasStationPriceJpaEntity(
                        stationId = stationId,
                        productCode = price.productCode,
                        price = price.price,
                        tradedAt = price.tradedAt,
                        updatedAt = now,
                    )
                } else {
                    row.update(price.price, price.tradedAt, now)
                }
            }
            // 이번에 안 온 유종은 더 이상 팔지 않는 것으로 본다 — 어제 가격이 남으면 안 된다
            toDelete += current.filterKeys { it !in incomingCodes }.values
        }

        if (toDelete.isNotEmpty()) priceRepository.deleteAll(toDelete)
        if (toSave.isNotEmpty()) priceRepository.saveAll(toSave)
    }

    private fun GasStationUpsertItem.toEntity(now: Instant) = GasStationJpaEntity(
        opinetId = opinetId,
        name = name,
        brandCode = brandCode,
        brandName = brandName,
        isSelf = isSelf,
        katecX = katecX,
        katecY = katecY,
        latitude = latitude,
        longitude = longitude,
        areaCode = areaCode,
        areaName = areaName,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
        tel = tel,
        hasCarWash = hasCarWash,
        hasMaintenance = hasMaintenance,
        hasCvs = hasCvs,
        is24h = is24h,
        syncedAt = now,
    )
}
