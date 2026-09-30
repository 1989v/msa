package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.domain.attraction.model.AttributeSelection
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldNotContain
import io.mockk.every
import io.mockk.mockk
import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.aggregations.Aggregate
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import org.springframework.data.domain.PageRequest
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.time.DayOfWeek
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 속성 패싯 — 어댑터가 **내놓는 요청 JSON** 을 본다. 본 질의(텍스트·벡터 레그)와 건수 요청을 모두 직렬화해
 * 필드·값을 읽는다. 속성 파라미터가 없는 요청은 패싯을 넣기 전 커밋에서 뜬 기준 JSON 과 바이트 단위로 같아야 한다.
 */
class AttractionSearchAdapterFacetTest : BehaviorSpec({

    val json = ObjectMapper()
    val none = AttributeSelection(today = DayOfWeek.MONDAY)

    fun <T> emptyResponse(aggregations: Map<String, Aggregate> = emptyMap()): SearchResponse<T> =
        SearchResponse.Builder<T>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h -> h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
            .aggregations(aggregations)
            .build()

    class Captured {
        val main = CopyOnWriteArrayList<SearchRequest>()
        val count = CopyOnWriteArrayList<SearchRequest>()
    }

    fun adapter(
        countAggregations: Map<String, Aggregate> = emptyMap(),
        countFails: Boolean = false,
    ): Pair<AttractionSearchAdapter, Captured> {
        val client = mockk<OpenSearchClient>()
        val captured = Captured()
        every { client.search(any<SearchRequest>(), AttractionSearchDocument::class.java) } answers {
            captured.main += firstArg<SearchRequest>()
            emptyResponse()
        }
        every { client.search(any<SearchRequest>(), JsonData::class.java) } answers {
            captured.count += firstArg<SearchRequest>()
            if (countFails) throw java.io.IOException("count down")
            emptyResponse(countAggregations)
        }
        return AttractionSearchAdapter(
            client,
            AttractionRankingProperties(),
            AttractionHybridProperties(enabled = true, k = 100),
            QueryVectorProperties(modelRef = AttractionSearchBaselineQueries.MODEL_REF),
        ) to captured
    }

    fun baseline(name: String): String =
        requireNotNull(javaClass.getResource("/attraction-search-baseline/$name.json")) { "기준 스냅샷 없음: $name" }
            .readText()

    fun tree(request: SearchRequest): JsonNode = json.readTree(request.toJsonString())

    /** 트리 안 모든 `term`/`terms` 의 (필드, 값) — 요청이 무엇으로 거르는지. */
    fun termFields(node: JsonNode): List<String> =
        node.findValues("term").flatMap { it.propertyNames() } + node.findValues("terms").flatMap { it.propertyNames() }

    given("속성 파라미터가 없는 요청") {
        AttractionSearchBaselineQueries.cases.forEach { (name, case) ->
            `when`("[$name] 을 속성 없이(null) 검색하면") {
                then("본 질의는 기준 JSON 과 바이트 단위로 같고 건수 요청은 없다") {
                    val (a, captured) = adapter()

                    a.search(case.first, case.second)

                    captured.main.single().toJsonString() shouldBe baseline(name)
                    captured.count.size shouldBe 0
                }
            }
            `when`("[$name] 을 아무것도 고르지 않은 선택으로, 건수 없이 검색하면 — API 기본 모양") {
                then("본 질의는 기준 JSON 과 같고 건수 요청은 0회다") {
                    val (a, captured) = adapter()

                    a.search(case.first.copy(attributes = none), case.second)

                    captured.main.single().toJsonString() shouldBe baseline(name)
                    captured.count.size shouldBe 0
                }
            }
            `when`("[$name] 을 아무것도 고르지 않은 선택으로, 건수를 요청해 검색하면(facets=true)") {
                then("본 질의는 여전히 기준 JSON 과 같고 건수 요청만 한 번 따로 나간다") {
                    val (a, captured) = adapter()

                    a.search(case.first.copy(attributes = none, countAttributeFacets = true), case.second)

                    captured.main.single().toJsonString() shouldBe baseline(name)
                    captured.count.size shouldBe 1
                }
            }
        }
    }

    given("속성을 고른 텍스트 검색") {
        val selection = none.copy(parking = true, pet = setOf(PetPolicy.ALLOWED, PetPolicy.PARTIAL))
        val query = AttractionSearchPort.SearchQuery(
            keyword = "한옥", lang = "ko", sidoCode = "11", attributes = selection, countAttributeFacets = true,
        )

        `when`("건수를 요청하지 않으면(facets=false)") {
            then("필터는 본 질의에 그대로 걸리고 건수 요청은 0회다") {
                val (a, captured) = adapter()

                a.search(query.copy(countAttributeFacets = false), PageRequest.of(0, 20))

                captured.count.size shouldBe 0
                termFields(tree(captured.main.single())) shouldContain "attrParking"
                termFields(tree(captured.main.single())) shouldContain "petPolicy"
            }
        }

        `when`("본 질의를 보면") {
            then("주차 YES 는 term, 반려동물 둘은 한 terms(OR) 로 필터에 있다 — 속성 사이는 AND") {
                val (a, captured) = adapter()

                a.search(query, PageRequest.of(0, 20))

                val filters = tree(captured.main.single()).findValue("bool")["filter"]
                val terms = filters.mapNotNull { it["term"] }
                terms.flatMap { it.propertyNames() } shouldContain "attrParking"
                terms.single { it.has("attrParking") }["attrParking"]["value"].asString() shouldBe "YES"
                val pet = filters.mapNotNull { it["terms"] }.single { it.has("petPolicy") }["petPolicy"]
                pet.values().map { it.asString() }.sorted() shouldBe listOf("ALLOWED", "PARTIAL")
            }
        }

        `when`("건수 요청을 보면") {
            then("본 질의와 같은 텍스트·구조 필터로 결과 0건을 요청하고, 속성 필터는 최상위에 없다") {
                val (a, captured) = adapter()

                a.search(query, PageRequest.of(0, 20))

                val count = tree(captured.count.single())
                count["size"].asInt() shouldBe 0
                count.findValue("multi_match")["query"].asString() shouldBe "한옥"
                val top = count["query"]
                termFields(top) shouldContain "lang"
                termFields(top) shouldContain "ldongRegnCd"
                termFields(top) shouldNotContain "attrParking"
                termFields(top) shouldNotContain "petPolicy"
                count.has("knn") shouldBe false
                count.has("sort") shouldBe false
            }
            then("각 속성의 건수는 자기 선택만 빼고 나머지 선택을 반영한다") {
                val (a, captured) = adapter()

                a.search(query, PageRequest.of(0, 20))

                val aggs = tree(captured.count.single())["aggregations"]
                // 주차 건수: 반려동물 선택은 걸고, 주차 조건은 버킷 자신의 한 번뿐
                val parking = aggs["parking_YES"]
                termFields(parking).count { it == "attrParking" } shouldBe 1
                termFields(parking) shouldContain "petPolicy"
                // 반려동물 건수: 주차 선택은 걸고, 반려동물 조건은 버킷 자신의 한 번뿐(선택의 terms 가 없다)
                for (bucket in listOf("pet_ALLOWED", "pet_PARTIAL")) {
                    val pet = aggs[bucket]
                    termFields(pet).count { it == "petPolicy" } shouldBe 1
                    termFields(pet) shouldContain "attrParking"
                }
                // 고르지 않은 속성: 고른 둘을 모두 반영
                termFields(aggs["creditCard_YES"]) shouldContain "attrParking"
                termFields(aggs["creditCard_YES"]) shouldContain "petPolicy"
                termFields(aggs["openToday"]) shouldContain "attrParking"
            }
            then("건수 버킷은 긍정 값뿐이다 — UNKNOWN·부정 값은 어디에도 요청되지 않는다") {
                val (a, captured) = adapter()

                a.search(query, PageRequest.of(0, 20))

                val count = tree(captured.count.single())
                count["aggregations"].propertyNames().toList() shouldContainExactlyInAnyOrder listOf(
                    "openToday", "parking_YES", "creditCard_YES", "strollerRental_YES",
                    "pet_ALLOWED", "pet_PARTIAL", "admission_FREE",
                )
                for (request in captured.main + captured.count) {
                    val body = request.toJsonString()
                    body shouldNotContain "\"UNKNOWN\""
                    body shouldNotContain "\"NO\""
                    body shouldNotContain "\"PAID\""
                }
            }
        }
    }

    given("속성을 고른 하이브리드 검색") {
        val selection = none.copy(creditCard = true, freeAdmission = true)
        val query = AttractionSearchPort.SearchQuery(
            keyword = "야시장", lang = "ko", embedding = AttractionSearchBaselineQueries.VECTOR, attributes = selection,
            countAttributeFacets = true,
        )

        `when`("본 질의를 보면") {
            then("키워드 레그와 벡터 레그의 knn filter 모두에 속성 필터가 있다 — 벡터 리콜을 잃지 않게") {
                val (a, captured) = adapter()

                a.search(query, PageRequest.of(0, 20))

                val legs = tree(captured.main.single())["query"]["hybrid"]["queries"]
                val keywordLeg = legs.single { !it.has("knn") }
                val knnFilter = legs.single { it.has("knn") }["knn"]["embedding"]["filter"]
                knnFilter shouldNotBe null
                for (leg in listOf(keywordLeg, knnFilter)) {
                    termFields(leg) shouldContain "attrCreditCard"
                    termFields(leg) shouldContain "attrAdmission"
                }
            }
        }
        `when`("건수 요청을 보면") {
            then("질의어를 빼고 구조 필터만 반영한다") {
                val (a, captured) = adapter()

                a.search(query, PageRequest.of(0, 20))

                val count = tree(captured.count.single())
                count.findValue("multi_match") shouldBe null
                count.findValue("match_all") shouldNotBe null
                termFields(count["query"]) shouldContain "lang"
                count.findValue("knn") shouldBe null
                count.findValue("hybrid") shouldBe null
            }
        }
    }

    given("「오늘 정기휴무 아님」") {
        `when`("일요일(KST)에 고르면") {
            then("연중무휴·매주 휴무 없음이거나, 매주 휴무이되 휴무 요일에 SUN 이 없는 문서만 남긴다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(
                        lang = "ko",
                        attributes = AttributeSelection(today = DayOfWeek.SUNDAY, openToday = true),
                        countAttributeFacets = true,
                    ),
                    PageRequest.of(0, 20),
                )

                val main = tree(captured.main.single())
                val open = main.findValue("bool")["filter"].single { f ->
                    f.has("bool") && f["bool"].has("should")
                }["bool"]
                open["minimum_should_match"].asString() shouldBe "1"
                val should = open["should"]
                should.mapNotNull { it["terms"]?.get("closureState") }.single().values().map { it.asString() }.sorted() shouldBe
                    listOf("ALWAYS_OPEN", "NO_WEEKLY")
                val weekly = should.single { it.has("bool") }["bool"]
                weekly["filter"].single()["term"]["closureState"]["value"].asString() shouldBe "WEEKLY"
                weekly["must_not"].single()["term"]["closedWeekdays"]["value"].asString() shouldBe "SUN"
                // 건수 요청의 버킷도 같은 요일로 센다
                tree(captured.count.single())["aggregations"]["openToday"].toString().contains("\"SUN\"") shouldBe true
            }
        }
    }

    given("건수 응답") {
        `when`("집계가 오면") {
            then("버킷 이름대로 건수를 읽는다") {
                fun agg(n: Long) = Aggregate.of { it.filter { f -> f.docCount(n) } }
                val (a, _) = adapter(
                    countAggregations = mapOf(
                        "openToday" to agg(7), "parking_YES" to agg(31605), "creditCard_YES" to agg(15864),
                        "strollerRental_YES" to agg(3), "pet_ALLOWED" to agg(9070), "pet_PARTIAL" to agg(503),
                        "admission_FREE" to agg(1127),
                    ),
                )

                val facets = a.search(AttractionSearchPort.SearchQuery(attributes = none, countAttributeFacets = true), PageRequest.of(0, 20))
                    .attributeFacets!!

                facets.openToday shouldBe 7
                facets.parking shouldBe 31605
                facets.creditCard shouldBe 15864
                facets.strollerRental shouldBe 3
                facets.pet shouldBe mapOf(PetPolicy.ALLOWED to 9070L, PetPolicy.PARTIAL to 503L)
                facets.freeAdmission shouldBe 1127
            }
        }
        `when`("건수 요청이 실패하면") {
            then("검색은 실패하지 않고 건수만 비운다") {
                val (a, captured) = adapter(countFails = true)

                val result = a.search(
                    AttractionSearchPort.SearchQuery(
                        keyword = "한옥", attributes = none.copy(parking = true), countAttributeFacets = true,
                    ),
                    PageRequest.of(0, 20),
                )

                result.attributeFacets shouldBe null
                result.page.totalElements shouldBe 0
                captured.main.size shouldBe 1
            }
        }
    }
})
