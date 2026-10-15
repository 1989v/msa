package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketSearchPort
import com.kgd.place.application.market.service.MarketPublicProjection
import com.kgd.place.application.market.usecase.SearchMarketsUseCase
import com.kgd.place.domain.market.model.Market
import com.kgd.place.infrastructure.persistence.market.repository.*
import com.kgd.place.infrastructure.persistence.attraction.entity.QAttractionJpaEntity
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper

@Component
class MarketSearchRepositoryAdapter(
    private val queries: MarketSearchQueryRepository,
    private val markets: MarketJpaRepository,
    private val overrides: MarketStoreOverrideJpaRepository,
    private val zones: MarketZoneJpaRepository,
    @Qualifier("placeJpaQueryFactory") private val factory: JPAQueryFactory,
) : MarketSearchPort {
    private val json = JsonMapper.builder().build()

    override fun search(query: String, lang: String, page: Int, size: Int): SearchMarketsUseCase.Result {
        val pageable = PageRequest.of(page, size)
        val counts = queries.counts(query)
        val marketRows = queries.marketRows(query, counts, pageable)
        val candidates = if (query.isEmpty()) null else queries.stores(query, pageable)
        val selected = candidates?.rows.orEmpty()
        val marketIds = selected.map { it.first.marketId }.distinct()
        val marketById = markets.findAllById(marketIds).map { it.toDomain() }.associateBy { it.id }
        val rows = selected.flatMap { listOfNotNull(it.first, it.second) }
        val allRows = queries.relatedStores((rows.mapNotNull { it.id } + rows.mapNotNull { it.referenceStoreId }).distinct())
        val edits = if (allRows.isEmpty()) emptyMap() else overrides.findAllByStoreIdIn(allRows.mapNotNull { it.id })
            .map { it.toDomain() }.groupBy { it.storeId }
        // Complete identity groups prevent ambiguous tenants from being incorrectly paired. The
        // isolated fallback also preserves page size at the documented SQL/NFKC normalization edge.
        val projected = MarketPublicProjection.stores(allRows, edits).associateBy { it.source.id }
        val displayed = selected.map { (store, partner) ->
            projected[store.id]
                ?: MarketPublicProjection.stores(listOfNotNull(store, partner), edits).first()
        }
        val attractions = attractions((marketRows.map { it.attractionContentId } +
            marketById.values.map { it.attractionContentId }).toSet(), lang)
        val zoneNames = zones.findAllById(displayed.mapNotNull { it.display.zoneId }.distinct()).associate { it.id to it.name }
        val summaries = displayed.map { row ->
            val market = marketById.getValue(row.source.marketId)
            SearchMarketsUseCase.StoreSummary(requireNotNull(row.source.id), row.display.name, row.display.items,
                listOfNotNull(row.source.categoryMajor, row.source.categoryMid, row.source.categorySub)
                    .takeIf { it.isNotEmpty() }?.joinToString(" > "),
                market.attractionContentId, market.name, zoneNames[row.display.zoneId],
                row.display.coordinate?.latitude, row.display.coordinate?.longitude,
                attractions[market.attractionContentId]?.ref())
        }
        val regions = regions(marketRows, attractions)
        return SearchMarketsUseCase.Result(query, marketRows.map { market ->
            SearchMarketsUseCase.MarketSummary(market.attractionContentId, market.name, regions[market.attractionContentId],
                market.marketType, counts[market.id] ?: 0, attractions[market.attractionContentId]?.ref())
        }, SearchMarketsUseCase.StorePage(summaries, candidates?.total ?: 0, page, size))
    }

    override fun contentIds(): List<String> = queries.contentIds(queries.counts())

    private class AttractionRow(val id: Long, val lang: String, val address: String?)

    /** Detail pages are keyed by attraction id per language; markets are keyed by the Korean contentId. */
    private fun attractions(contentIds: Collection<String>, lang: String): Map<String, AttractionRow> {
        if (contentIds.isEmpty()) return emptyMap()
        val attraction = QAttractionJpaEntity.attractionJpaEntity
        return factory.select(attraction.id, attraction.contentId, attraction.lang, attraction.address).from(attraction)
            .where(attraction.contentId.`in`(contentIds), attraction.lang.`in`(lang, "ko"), attraction.source.eq("TOURAPI"))
            .fetch().groupBy { requireNotNull(it[attraction.contentId]) }
            .mapValues { (_, rows) ->
                val row = rows.firstOrNull { it[attraction.lang] == lang } ?: rows.first()
                AttractionRow(requireNotNull(row[attraction.id]), requireNotNull(row[attraction.lang]), row[attraction.address])
            }
    }

    private fun regions(markets: List<Market>, attractions: Map<String, AttractionRow>): Map<String, String?> =
        markets.associate { market ->
            val raw = market.sourceRaw?.let { json.readTree(it) }
            val sigungu = listOf("sigungu", "시군구명").firstNotNullOfOrNull { key ->
                raw?.get(key)?.takeUnless { it.isNull }?.asText()?.takeIf { it.isNotBlank() }
            }
            val region = sigungu ?: attractions[market.attractionContentId]?.address?.trim()?.split(Regex("\\s+"))
                ?.filter { it.isNotBlank() }?.take(2)?.joinToString(" ")?.takeIf { it.isNotBlank() }
            market.attractionContentId to region
        }

    private fun AttractionRow.ref() = SearchMarketsUseCase.AttractionRef(id, lang)
}
