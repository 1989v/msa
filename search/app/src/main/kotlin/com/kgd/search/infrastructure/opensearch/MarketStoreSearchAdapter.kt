package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.marketstore.port.MarketStoreSearchPort
import com.kgd.search.application.marketstore.usecase.SearchMarketStoreUseCase
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.stereotype.Component

@Component
class MarketStoreSearchAdapter(private val client: OpenSearchClient) : MarketStoreSearchPort {
    override fun search(query: SearchMarketStoreUseCase.Query): SearchMarketStoreUseCase.Result {
        val response = client.search(request(query), MarketStoreSearchDocument::class.java)
        val items = response.hits().hits().mapNotNull { hit -> hit.source()?.let { doc ->
            item(doc, hit.matchedQueries(), hit.score() ?: 0.0, query.lang)
        } }
        val markets = response.aggregations()["markets"]?.sterms()?.buckets()?.array().orEmpty().map { bucket ->
            val name = bucket.aggregations()["names"]?.sterms()?.buckets()?.array()?.firstOrNull()?.key() ?: ""
            val doc = bucket.aggregations()["metadata"]?.topHits()?.hits()?.hits()?.firstOrNull()?.source()
                ?.to(MarketStoreSearchDocument::class.java)
            SearchMarketStoreUseCase.Market(bucket.key(), name, bucket.docCount(), doc?.marketNameEn,
                doc?.region, doc?.marketType, doc?.attraction(query.lang))
        }
        return SearchMarketStoreUseCase.Result(items, response.hits().total()?.value() ?: 0, markets)
    }

    internal fun item(doc: MarketStoreSearchDocument, matchedQueries: List<String>, score: Double, lang: String) =
        SearchMarketStoreUseCase.Item(doc.storeId, doc.contentId,
                matchedQueries.map { it.substringBefore('_') }.distinct(), score,
                name = doc.name, nameEn = doc.nameEn, categorySub = doc.categorySub, categorySubEn = doc.categorySubEn,
                address = doc.roadAddress?.takeIf { it.isNotBlank() } ?: doc.jibunAddress,
                buildingName = doc.buildingName, dong = doc.dong, floor = doc.floor, ho = doc.ho,
                goodPrice = doc.goodPrice, goodPriceMenus = doc.goodPriceMenus, sources = doc.sources,
                membership = doc.membership, nearby = doc.nearby, marketName = doc.marketName, attraction = doc.attraction(lang))

    private fun MarketStoreSearchDocument.attraction(lang: String): SearchMarketStoreUseCase.Attraction? =
        if (lang == "en" && attractionIdEn != null) SearchMarketStoreUseCase.Attraction(attractionIdEn, "en")
        else attractionIdKo?.let { SearchMarketStoreUseCase.Attraction(it, "ko") }

    internal fun request(query: SearchMarketStoreUseCase.Query): SearchRequest {
        val englishPriority = query.lang == "en" ||
            (query.q.all { it.code in 32..126 } && query.q.any { it in 'a'..'z' || it in 'A'..'Z' })
        val groups = linkedMapOf(
            "NAME" to listOf("name", "nameEn"), "ROMAN" to listOf("nameRoman"),
            "DISH" to listOf("dishes", "dishesEn"), "ITEMS" to listOf("items", "itemsEn"),
            "MENU" to listOf("menus"),
            "CATEGORY" to listOf("categoryMajor", "categoryMid", "categorySub", "categoryMajorEn", "categoryMidEn", "categorySubEn"),
        )
        val weights = mapOf("NAME" to 4f, "ROMAN" to 4f, "DISH" to 3f, "ITEMS" to 2f, "MENU" to 2f, "CATEGORY" to 1f)
        return SearchRequest.Builder().index("market-stores").from(query.page * query.size).size(query.size)
            .source { it.filter { filter -> filter.includes(ITEM_FIELDS) } }
            .trackTotalHits { it.enabled(true) }
            .query { q -> q.bool { b ->
                query.contentId?.let { id -> b.filter { f -> f.term { it.field("contentId").value(FieldValue.of(id)) } } }
                groups.forEach { (group, fields) -> fields.forEach { field ->
                    b.should { s -> s.match { m ->
                        m.field(field).query(FieldValue.of(query.q)).queryName("${group}_$field")
                            .boost(weights.getValue(group) * if (englishPriority && field.endsWith("En")) 2f else 1f)
                            .apply { if (group == "NAME" || group == "ROMAN") fuzziness("AUTO") }
                    } }
                } }
                b.minimumShouldMatch("1")
            } }
            .apply { if (query.contentId == null) aggregations("markets") { a ->
                a.terms { it.field("contentId").size(1000) }
                    .aggregations("names") { n -> n.terms { it.field("marketName").size(1) } }
                    .aggregations("metadata") { n -> n.topHits { hit -> hit.size(1)
                        .source { it.filter { filter -> filter.includes(MARKET_FIELDS) } } } }
            } }.build()
    }
    companion object {
        internal val MARKET_FIELDS = listOf("marketNameEn", "region", "marketType", "attractionIdKo", "attractionIdEn")
        internal val ITEM_FIELDS = listOf("storeId", "contentId", "name", "nameEn", "categorySub", "categorySubEn",
            "roadAddress", "jibunAddress", "buildingName", "dong", "floor", "ho", "goodPrice", "goodPriceMenus",
            "sources", "membership", "nearby", "marketName", "attractionIdKo", "attractionIdEn")
    }
}
