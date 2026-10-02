package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.domain.attraction.model.AttributeSelection
import io.mockk.every
import io.mockk.mockk
import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import java.time.DayOfWeek
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 행사 필터가 없는 요청의 경로별 요청 JSON — 패싯 건수 · 랭킹 끔 · 클릭 계수 · 자동완성 지역.
 * 행사 필터를 넣기 **전** 커밋에서 이 함수들로 뜬 결과가 `attraction-search-baseline-event/{name}.json` 이다.
 * 본 질의 7종은 `attraction-search-baseline/` 이 이미 갖고 있어 여기서 다시 뜨지 않는다.
 * 항목을 고치면 기준을 새로 떠야 하므로 고치지 않는다.
 */
object AttractionSearchRequestSnapshots {

    class Captured {
        val main = CopyOnWriteArrayList<SearchRequest>()
        val count = CopyOnWriteArrayList<SearchRequest>()
        val regions = CopyOnWriteArrayList<SearchRequest>()
    }

    private fun <T> emptyResponse(): SearchResponse<T> =
        SearchResponse.Builder<T>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h -> h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
            .build()

    fun adapter(
        ranking: AttractionRankingProperties = AttractionRankingProperties(),
        clickBoost: Boolean = false,
    ): Pair<AttractionSearchAdapter, Captured> {
        val client = mockk<OpenSearchClient>()
        val captured = Captured()
        every { client.search(any<SearchRequest>(), AttractionSearchDocument::class.java) } answers {
            captured.main += firstArg<SearchRequest>()
            emptyResponse()
        }
        every { client.search(any<SearchRequest>(), JsonData::class.java) } answers {
            captured.count += firstArg<SearchRequest>()
            // 집계가 없어 건수 조립은 실패한다 — 요청 모양만 본다
            emptyResponse()
        }
        every { client.search(any<SearchRequest>(), RegionSearchDocument::class.java) } answers {
            captured.regions += firstArg<SearchRequest>()
            emptyResponse()
        }
        return AttractionSearchAdapter(
            client,
            ranking,
            AttractionHybridProperties(enabled = true, k = 100),
            QueryVectorProperties(modelRef = AttractionSearchBaselineQueries.MODEL_REF),
            AttractionClickBoostProperties(enabled = clickBoost),
        ) to captured
    }

    private val none = AttributeSelection(today = DayOfWeek.MONDAY)
    private val RANKING_OFF = AttractionRankingProperties(sightWeight = 1.0, commerceWeight = 1.0)

    private fun mainOf(name: String, ranking: AttractionRankingProperties = AttractionRankingProperties(), clickBoost: Boolean = false): String {
        val (a, captured) = adapter(ranking, clickBoost)
        val (query, page) = AttractionSearchBaselineQueries.cases.getValue(name)
        a.search(query, page)
        return captured.main.single().toJsonString()
    }

    private fun countOf(name: String): String {
        val (a, captured) = adapter()
        val (query, page) = AttractionSearchBaselineQueries.cases.getValue(name)
        a.search(query.copy(attributes = none, countAttributeFacets = true), page)
        return captured.count.single().toJsonString()
    }

    /** 경로 이름 → 그 경로가 지금 내는 요청 JSON. */
    val cases: Map<String, () -> String> = buildMap {
        AttractionSearchBaselineQueries.cases.keys.forEach { name -> put("count-$name") { countOf(name) } }
        put("ranking-off-keyword-only") { mainOf("keyword-only", RANKING_OFF) }
        put("ranking-off-browse-geo-distance") { mainOf("browse-geo-distance", RANKING_OFF) }
        put("ranking-off-hybrid") { mainOf("hybrid", RANKING_OFF) }
        put("click-boost-keyword-only") { mainOf("keyword-only", clickBoost = true) }
        put("click-boost-hybrid") { mainOf("hybrid", clickBoost = true) }
    }
}
