package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.domain.attraction.model.AttributeSelection
import com.kgd.search.domain.attraction.model.EventDateRange
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import org.springframework.data.domain.PageRequest
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.time.DayOfWeek
import java.time.LocalDate
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 어휘 근거(GATE)·한정(CONFINE) — 어댑터가 **내놓는 요청**과 그 순서를 본다.
 *
 * 스텁은 근거 요청(`size 0` + `terminate_after`)에만 [evidenceTotal] 을 돌려준다. 다른 요청은 늘 0건이다 —
 * 기존 스냅숏 스텁(늘 total 0)으로는 「근거 있음」 경로를 열 수 없다.
 */
class AttractionSearchAdapterEvidenceTest : BehaviorSpec({

    val json = ObjectMapper()
    val msm = AttractionSearchPort.EVIDENCE_MINIMUM_SHOULD_MATCH

    fun <T> response(total: Long): SearchResponse<T> =
        SearchResponse.Builder<T>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h -> h.total { t -> t.value(total).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
            .build()

    class Calls {
        /** 요청 종류를 나간 순서대로 — evidence · count · main */
        val order = CopyOnWriteArrayList<String>()
        val evidence = CopyOnWriteArrayList<SearchRequest>()
        val count = CopyOnWriteArrayList<SearchRequest>()
        val main = CopyOnWriteArrayList<SearchRequest>()
    }

    fun SearchRequest.isEvidence() = size() == 0 && terminateAfter() != null

    fun adapter(
        evidenceTotal: Long = 1,
        evidenceFails: Boolean = false,
        countFails: Boolean = false,
    ): Pair<AttractionSearchAdapter, Calls> {
        val client = mockk<OpenSearchClient>()
        val calls = Calls()
        every { client.search(any<SearchRequest>(), AttractionSearchDocument::class.java) } answers {
            calls.order += "main"
            calls.main += firstArg<SearchRequest>()
            response(0)
        }
        every { client.search(any<SearchRequest>(), JsonData::class.java) } answers {
            val request = firstArg<SearchRequest>()
            if (request.isEvidence()) {
                calls.order += "evidence"
                calls.evidence += request
                if (evidenceFails) throw java.io.IOException("opensearch timeout")
                response(evidenceTotal)
            } else {
                calls.order += "count"
                calls.count += request
                if (countFails) throw java.io.IOException("count down")
                response(0)
            }
        }
        return AttractionSearchAdapter(
            client,
            // 분류 가중치를 끄면 본 질의가 일치 bool 그대로라 근거 요청과 필터를 나란히 비교할 수 있다
            AttractionRankingProperties(sightWeight = 1.0, commerceWeight = 1.0),
            AttractionHybridProperties(enabled = true, k = 100),
            QueryVectorProperties(modelRef = AttractionSearchBaselineQueries.MODEL_REF),
        ) to calls
    }

    fun tree(request: SearchRequest): JsonNode = json.readTree(request.toJsonString())

    /** 트리 안의 multi_match 전부 */
    fun multiMatches(node: JsonNode): List<JsonNode> = buildList {
        fun walk(n: JsonNode) {
            if (n.isObject) n.properties().forEach { (k, v) -> if (k == "multi_match") add(v); walk(v) }
            if (n.isArray) n.forEach(::walk)
        }
        walk(node)
    }

    val page = PageRequest.of(0, 20)
    val selection = AttributeSelection(today = DayOfWeek.MONDAY, parking = true)
    val filtered = AttractionSearchPort.SearchQuery(
        keyword = "에펠탑",
        lang = "ko",
        sidoCode = "11",
        categories = listOf("history"),
        facets = mapOf("contentTypeId" to "12"),
        attributes = selection,
        eventRange = EventDateRange(startGte = null, startLte = null, endGte = LocalDate.of(2026, 10, 11)),
        evidenceKeyword = "에펠탑",
    )

    given("OFF — 근거·한정 필드가 기본값") {
        `when`("검색하면") {
            then("본 질의가 기능을 넣기 전 기준 JSON 과 같고 근거 요청은 없다") {
                listOf("keyword-only", "hybrid").forEach { name ->
                    val (a, captured) = AttractionSearchRequestSnapshots.adapter()
                    val (query, p) = AttractionSearchBaselineQueries.cases.getValue(name)
                    a.search(query.copy(evidenceKeyword = null, confine = false), p)
                    val expected = requireNotNull(javaClass.getResource("/attraction-search-baseline/$name.json")).readText()
                    captured.main.single().toJsonString() shouldBe expected
                    captured.count.size shouldBe 0
                }
            }
        }
    }

    given("GATE — 근거 잔여가 있고 근거가 있을 때") {
        `when`("건수와 함께 검색하면") {
            val (a, calls) = adapter(evidenceTotal = 1)
            val result = a.search(filtered.copy(countAttributeFacets = true), page)

            then("근거 요청이 먼저 나가고, 그 뒤에 건수·본 질의가 나간다") {
                calls.order.first() shouldBe "evidence"
                calls.order.drop(1).toSet() shouldBe setOf("count", "main")
                result.noEvidence shouldBe false
            }
            then("근거 요청은 size 0 · terminate_after 1 · track_total_hits 1 · msm 2<75%") {
                val e = tree(calls.evidence.single())
                e["size"].asInt() shouldBe 0
                e["terminate_after"].asLong() shouldBe 1
                e["track_total_hits"].asInt() shouldBe 1
                val mm = multiMatches(e).single()
                mm["query"].asText() shouldBe "에펠탑"
                mm["minimum_should_match"].asText() shouldBe msm
            }
            then("근거 요청의 필터는 본 질의와 같다 — 지역 코드까지") {
                val evidenceFilters = tree(calls.evidence.single())["query"]["bool"]["filter"]
                val mainFilters = tree(calls.main.single())["query"]["bool"]["filter"]
                evidenceFilters shouldBe mainFilters
                evidenceFilters.any { it["term"]?.has("ldongRegnCd") == true } shouldBe true
                evidenceFilters.any { it["term"]?.has("attrParking") == true } shouldBe true
            }
            then("본 질의의 검색어 일치에는 msm 을 걸지 않는다 — GATE 는 결과 유무만 정한다") {
                multiMatches(tree(calls.main.single())).single().has("minimum_should_match") shouldBe false
            }
        }
    }

    given("GATE — 근거가 0건일 때") {
        `when`("검색하면") {
            val (a, calls) = adapter(evidenceTotal = 0)
            val result = a.search(filtered.copy(countAttributeFacets = true), page)

            then("본 질의와 건수 요청을 내지 않고 빈 페이지·noEvidence") {
                calls.order shouldBe listOf("evidence")
                result.page.totalElements shouldBe 0
                result.page.content shouldBe emptyList()
                result.noEvidence shouldBe true
                result.attributeFacets shouldBe null
            }
        }
    }

    given("근거 잔여가 없을 때(evidenceKeyword = null)") {
        `when`("검색하면") {
            val (a, calls) = adapter()
            a.search(filtered.copy(evidenceKeyword = null), page)

            then("근거 요청을 내지 않는다") { calls.evidence.size shouldBe 0 }
        }
    }

    given("근거 요청이 실패하면") {
        `when`("검색하면") {
            then("예외가 올라간다 — 0건으로 삼키지 않는다") {
                val (a, calls) = adapter(evidenceFails = true)
                shouldThrow<java.io.IOException> { a.search(filtered, page) }
                calls.main.size shouldBe 0
            }
        }
        `when`("건수 요청만 실패하면") {
            then("지금처럼 건수 없이 결과를 낸다") {
                val (a, calls) = adapter(countFails = true)
                val result = a.search(filtered.copy(countAttributeFacets = true), page)
                calls.main.size shouldBe 1
                result.attributeFacets shouldBe null
                result.noEvidence shouldBe false
            }
        }
    }

    given("CONFINE — 한정") {
        val confined = AttractionSearchPort.SearchQuery(
            keyword = "에펠탑",
            lang = "ko",
            embedding = AttractionSearchBaselineQueries.VECTOR,
            attributes = AttributeSelection(today = DayOfWeek.MONDAY),
            countAttributeFacets = true,
            confine = true,
        )
        `when`("하이브리드로 검색하면") {
            val (a, calls) = adapter()
            a.search(confined, page)
            val main = tree(calls.main.single())

            then("근거 요청은 내지 않는다") { calls.evidence.size shouldBe 0 }
            then("키워드 레그와 knn filter 의 검색어 일치 모두에 msm 이 걸린다") {
                val legs = main["query"]["hybrid"]["queries"]
                val keywordLeg = legs.single { !it.has("knn") }
                val knnLeg = legs.single { it.has("knn") }
                multiMatches(keywordLeg).single()["minimum_should_match"].asText() shouldBe msm
                multiMatches(knnLeg).single()["minimum_should_match"].asText() shouldBe msm
            }
            then("건수 요청도 검색어를 넣고 같은 msm 으로 센다") {
                val mm = multiMatches(tree(calls.count.single())).single()
                mm["query"].asText() shouldBe "에펠탑"
                mm["minimum_should_match"].asText() shouldBe msm
            }
        }
    }
})
