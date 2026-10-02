package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 클릭 계수 스위치 — 어댑터가 **내놓는 요청 JSON** 을 본다.
 * 꺼져 있으면 기준 스냅샷과 바이트 단위로 같고, 켜면 키워드 레그의 점수 함수에만 붙는다.
 */
class AttractionSearchAdapterClickBoostTest : BehaviorSpec({

    val json = ObjectMapper()

    fun <T> emptyResponse(): SearchResponse<T> =
        SearchResponse.Builder<T>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h -> h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
            .build()

    fun adapter(enabled: Boolean): Pair<AttractionSearchAdapter, MutableList<SearchRequest>> {
        val client = mockk<OpenSearchClient>()
        val sent = mutableListOf<SearchRequest>()
        every { client.search(any<SearchRequest>(), AttractionSearchDocument::class.java) } answers {
            sent += firstArg<SearchRequest>()
            emptyResponse()
        }
        every { client.search(any<SearchRequest>(), RegionSearchDocument::class.java) } returns emptyResponse()
        return AttractionSearchAdapter(
            client,
            AttractionRankingProperties(),
            AttractionHybridProperties(enabled = true, k = 100),
            QueryVectorProperties(modelRef = AttractionSearchBaselineQueries.MODEL_REF),
            AttractionClickBoostProperties(enabled = enabled),
        ) to sent
    }

    fun baseline(name: String): String =
        requireNotNull(javaClass.getResource("/attraction-search-baseline/$name.json")) { "기준 스냅샷 없음: $name" }.readText()

    /** 트리 안 fvf 가 곱하는 필드 이름 전부. */
    fun factorFields(node: JsonNode): List<String> =
        node.findValues("field_value_factor").map { it.get("field").asString() }

    fun search(enabled: Boolean, case: String): JsonNode {
        val (a, sent) = adapter(enabled)
        val (query, page) = AttractionSearchBaselineQueries.cases.getValue(case)
        a.search(query, page)
        return json.readTree(sent.single().toJsonString())
    }

    given("스위치가 꺼져 있을 때(기본값)") {
        then("기본 설정은 꺼짐이다") {
            AttractionClickBoostProperties().enabled shouldBe false
        }
        AttractionSearchBaselineQueries.cases.forEach { (name, case) ->
            then("[$name] 요청은 기준 스냅샷과 바이트 단위로 같다") {
                val (a, sent) = adapter(enabled = false)
                a.search(case.first, case.second)
                sent.single().toJsonString() shouldBe baseline(name)
            }
        }
    }

    given("스위치를 켰을 때") {
        then("키워드 단독 검색은 점수 함수에 clickBoost 를 곱한다") {
            val tree = search(enabled = true, case = "keyword-only")
            factorFields(tree) shouldContain "clickBoost"
            factorFields(tree) shouldContain "popularityScore"
        }

        then("하이브리드는 키워드 레그에만 붙고 벡터 레그에는 없다") {
            val queries = search(enabled = true, case = "hybrid").get("query").get("hybrid").get("queries")
            factorFields(queries.get(0)) shouldContain "clickBoost"
            factorFields(queries.get(1)) shouldNotContain "clickBoost"
        }

        then("벡터 단독·상업 의도·검색어 없는 목록은 그대로다") {
            listOf("vector-only", "commerce-intent", "browse-geo-distance").forEach { name ->
                val (a, sent) = adapter(enabled = true)
                val (query, page) = AttractionSearchBaselineQueries.cases.getValue(name)
                a.search(query, page)
                sent.single().toJsonString() shouldBe baseline(name)
            }
        }

        then("자동완성에는 붙지 않는다 — 입력 중인 접두어에는 관련도라 할 것이 없다") {
            val (a, sent) = adapter(enabled = true)
            a.suggest("경복", "ko", 5, com.kgd.search.domain.attraction.model.EventDateRange(null, null, java.time.LocalDate.of(2026, 10, 7)))
            // 지역 자동완성은 다른 문서 타입이라 여기 안 잡힌다 — 잡힌 것은 관광지 자동완성 요청이다
            factorFields(json.readTree(sent.single().toJsonString())) shouldNotContain "clickBoost"
        }
    }
})
