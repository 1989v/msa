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
        val zoneNames = zones.findAllById(displayed.mapNotNull { it.display.zoneId }.distinct()).associate { it.id to it.name }
        val summaries = displayed.map { row ->
            val market = marketById.getValue(row.source.marketId)
            SearchMarketsUseCase.StoreSummary(requireNotNull(row.source.id), row.display.name, row.display.items,
                listOfNotNull(row.source.categoryMajor, row.source.categoryMid, row.source.categorySub)
                    .takeIf { it.isNotEmpty() }?.joinToString(" > "),
                market.attractionContentId, market.name, zoneNames[row.display.zoneId],
                row.display.coordinate?.latitude, row.display.coordinate?.longitude)
        }
        val regions = regions(marketRows, lang)
        return SearchMarketsUseCase.Result(query, marketRows.map { market ->
            SearchMarketsUseCase.MarketSummary(market.attractionContentId, market.name, regions[market.attractionContentId],
                market.marketType, counts[market.id] ?: 0)
        }, SearchMarketsUseCase.StorePage(summaries, candidates?.total ?: 0, page, size))
    }

    override fun contentIds(): List<String> = queries.contentIds(queries.counts())

    private fun regions(markets: List<Market>, lang: String): Map<String, String?> {
        if (markets.isEmpty()) return emptyMap()
        val attraction = QAttractionJpaEntity.attractionJpaEntity
        val addresses = factory.select(attraction.contentId, attraction.address).from(attraction)
            .where(attraction.contentId.`in`(markets.map { it.attractionContentId }), attraction.lang.eq(lang),
                attraction.source.eq("TOURAPI"))
            .fetch().associate { requireNotNull(it[attraction.contentId]) to it[attraction.address] }
        return markets.associate { market ->
            val raw = market.sourceRaw?.let { json.readTree(it) }
            val sigungu = listOf("sigungu", "시군구명").firstNotNullOfOrNull { key ->
                raw?.get(key)?.takeUnless { it.isNull }?.asText()?.takeIf { it.isNotBlank() }
            }
            val region = sigungu ?: addresses[market.attractionContentId]?.trim()?.split(Regex("\\s+"))
                ?.filter { it.isNotBlank() }?.take(2)?.joinToString(" ")?.takeIf { it.isNotBlank() }
            market.attractionContentId to region
        }
    }
}
