package com.kgd.place.application.market.service

import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.domain.market.model.MarketMembershipStatus
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreDisplay
import com.kgd.place.domain.market.model.MarketStoreOverride
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketPinKind
import com.kgd.place.domain.market.model.MarketStoreIdentity

/** Response-only reconciliation. No persistence row or upstream payload is changed. */
internal object MarketPublicProjection {
    /**
     * ONNURI store id → SANGGA store id for one shop listed by both sources. Ingest stores the result as
     * `paired_store_id` so search pairs rows by primary key with the same rule as this projection.
     */
    fun pairs(rows: List<MarketStore>): Map<Long, Long> {
        val candidates = rows.mapNotNull { row -> MarketStoreIdentity.key(row)?.let { (row.marketId to it) to row } }
            .groupBy({ it.first }, { it.second })
        val pairs = mutableMapOf<Long, Long>()
        candidates.values.forEach { group ->
            // Ambiguous multiple tenants from either source are deliberately left separate.
            val onnuri = group.filter { it.source == MarketStoreSource.ONNURI }.singleOrNull()
            val sangga = group.filter { it.source == MarketStoreSource.SANGGA }.singleOrNull()
            if (onnuri?.id != null && sangga?.id != null) pairs[requireNotNull(onnuri.id)] = requireNotNull(sangga.id)
        }
        return pairs
    }

    fun stores(rows: List<MarketStore>, overrides: Map<Long, List<MarketStoreOverride>>, pathIds: Set<Long>? = null): List<QueryMarketUseCase.Store> {
        val rowsById = rows.associateBy { it.id }
        val pairs = pairs(rows)
        val partners = pairs.mapValues { (_, sanggaId) -> rowsById.getValue(sanggaId) }
        val canonicalIds = pairs.entries.associate { (onnuriId, sanggaId) -> sanggaId to onnuriId }
        val projected = rows.filter { it.id !in canonicalIds }.map { row ->
            val other = partners[row.id]
            val ownOverrides = overrides[row.id].orEmpty()
            val otherOverrides = overrides[other?.id].orEmpty()
            // Explicit edits win over source values, with ONNURI winning conflicting edits.
            val fields = ownOverrides.map { it.field }.toSet()
            val mergedOverrides = ownOverrides + otherOverrides.filter { it.field !in fields }
                .map { it.copy(storeId = requireNotNull(row.id)) }
            val base = if (other == null) row else row.copy(
                items = row.items ?: other.items,
                zoneId = row.zoneId ?: other.zoneId,
                latitude = row.latitude ?: other.latitude,
                longitude = row.longitude ?: other.longitude,
                roadAddress = row.roadAddress ?: other.roadAddress,
                buildingManagementNo = row.buildingManagementNo ?: other.buildingManagementNo,
                buildingName = row.buildingName ?: other.buildingName,
                dong = row.dong ?: other.dong,
                floor = row.floor ?: other.floor,
                ho = row.ho ?: other.ho,
                roadName = row.roadName ?: other.roadName,
                categoryMajor = row.categoryMajor ?: other.categoryMajor,
                categoryMid = row.categoryMid ?: other.categoryMid,
                categorySub = row.categorySub ?: other.categorySub,
                goodPriceKey = if (row.goodPriceRaw != null) row.goodPriceKey else other.goodPriceKey,
                goodPriceRaw = row.goodPriceRaw ?: other.goodPriceRaw,
                goodPriceMatchedBy = if (row.goodPriceRaw != null) row.goodPriceMatchedBy else other.goodPriceMatchedBy,
                goodPriceMenuNames = if (row.goodPriceRaw != null) row.goodPriceMenuNames else other.goodPriceMenuNames,
            )
            val publicSource = if (base.referenceStoreId in canonicalIds)
                base.copy(referenceStoreId = canonicalIds.getValue(requireNotNull(base.referenceStoreId))) else base
            val pathOverride = mergedOverrides.find { it.field == com.kgd.place.domain.market.model.MarketStoreField.PATH_ID }
            val correctedPathId = pathOverride?.value?.toLong()
            val effectiveSource = if (pathOverride == null || (correctedPathId != null && pathIds != null && correctedPathId !in pathIds))
                publicSource else publicSource.copy(pathId = correctedPathId)
            val display = MarketStoreDisplay.from(effectiveSource, mergedOverrides)
            val sources = MarketStoreSource.entries.filter { source ->
                listOfNotNull(row, other).any {
                    it.source == source || (source == MarketStoreSource.ONNURI && (!it.onnuriKey.isNullOrBlank() || it.onnuriRaw != null)) ||
                        (source == MarketStoreSource.SANGGA && (!it.sanggaKey.isNullOrBlank() || it.sanggaRaw != null))
                }
            }
            QueryMarketUseCase.Store(effectiveSource, if (display.membership.status == MarketMembershipStatus.UNKNOWN)
                display.copy(coordinate = null) else display, sources)
        }
        val byId = projected.associateBy { it.source.id }
        return projected.map { row ->
            if (row.display.pinKind != MarketPinKind.REFERENCE || row.display.membership.status != MarketMembershipStatus.IN) row
            else {
                val neighbor = byId[row.source.referenceStoreId]
                val coordinate = neighbor?.takeIf { it.source.marketId == row.source.marketId &&
                    it.display.pinKind == MarketPinKind.EXACT && it.display.membership.status == MarketMembershipStatus.IN }?.display?.coordinate
                row.copy(display = row.display.copy(coordinate = row.display.coordinate ?: coordinate))
            }
        }
    }
}
