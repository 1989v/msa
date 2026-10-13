package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.model.AttractionCompanion
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import org.springframework.data.domain.PageRequest
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 벡터 레그 분류 가중치 · 소개문 고유도 · 동행 적합 — 두 레그에 같은 점수 함수가 걸리는지 요청 모양으로 본다.
 * 판정 근거는 어댑터가 내놓은 요청 JSON 이다. 실제 순위는 OpenSearch 가 정한다.
 */
class AttractionSearchAdapterVectorLegTest : BehaviorSpec({

    val json = ObjectMapper()
    val vector = AttractionSearchBaselineQueries.VECTOR
    val page = PageRequest.of(0, 20)

    fun request(query: AttractionSearchPort.SearchQuery, ranking: AttractionRankingProperties = AttractionRankingProperties()): JsonNode {
        val (a, captured) = AttractionSearchRequestSnapshots.adapter(ranking)
        a.search(query, page)
        return json.readTree(captured.main.single().toJsonString())
    }

    /** function_score 의 함수 요약 — 가중치 함수는 `weight:{값}`(동행은 `companions=KIDS:{값}`), fvf 는 필드 이름. */
    fun functionsOf(node: JsonNode): List<String> = node["function_score"]["functions"].iterator().asSequence().toList().map { f ->
        when {
            f.has("field_value_factor") -> f["field_value_factor"]["field"].asString()
            f["filter"]?.findValue("companions") != null -> "companions=${f["filter"].findValue("companions").findValue("value").asString()}:${f["weight"].asDouble()}"
            else -> "weight:${f["weight"].asDouble().toFloat()}"
        }
    }

    fun vectorLegOf(root: JsonNode): JsonNode = root["query"]["hybrid"]["queries"].single { it.findValue("knn") != null }
    fun keywordLegOf(root: JsonNode): JsonNode = root["query"]["hybrid"]["queries"].single { it.findValue("knn") == null }

    given("벡터 단독 질의(동반 표현만 있는 「family friendly for kids place」)") {
        val query = AttractionSearchPort.SearchQuery(lang = "en", embedding = vector)

        `when`("기본 설정이면") {
            then("knn 을 function_score 로 감싸 분류 가중치 둘과 소개문 고유도를 곱하고, 완결성은 걸지 않는다") {
                val q = request(query)["query"]
                q["function_score"]["query"].has("knn") shouldBe true
                functionsOf(q) shouldContainExactlyInAnyOrder listOf("weight:3.0", "weight:0.35", "contentUniqueness")
                functionsOf(q) shouldNotContain "popularityScore"
                q["function_score"]["score_mode"].asString() shouldBe "multiply"
                q["function_score"]["boost_mode"].asString() shouldBe "multiply"
            }
        }
        `when`("벡터 레그 스위치와 고유도 스위치를 끄면") {
            then("이전과 같은 맨 knn 이다") {
                val q = request(query, AttractionRankingProperties(vectorLeg = false, contentUniqueness = false))["query"]
                q.has("knn") shouldBe true
                q.has("function_score") shouldBe false
            }
        }
        `when`("상업 의도 질의면") {
            then("분류 가중치는 빼고 소개문 고유도만 곱한다 — 키워드 레그와 같다") {
                val q = request(query.copy(commerceIntent = true))["query"]
                functionsOf(q) shouldBe listOf("contentUniqueness")
            }
        }
    }

    given("하이브리드 질의") {
        val query = AttractionSearchPort.SearchQuery(keyword = "palace", lang = "en", embedding = vector)

        then("두 레그 모두 분류 가중치·고유도를 곱하고, 완결성은 키워드 레그에만 있다") {
            val root = request(query)
            functionsOf(keywordLegOf(root)) shouldContainExactlyInAnyOrder
                listOf("weight:3.0", "weight:0.35", "popularityScore", "contentUniqueness")
            functionsOf(vectorLegOf(root)) shouldContainExactlyInAnyOrder listOf("weight:3.0", "weight:0.35", "contentUniqueness")
        }
        then("벡터 레그 스위치만 끄면 벡터 레그는 맨 knn 이고 키워드 레그는 그대로다") {
            val root = request(query, AttractionRankingProperties(vectorLeg = false))
            vectorLegOf(root).has("knn") shouldBe true
            functionsOf(keywordLegOf(root)) shouldContain "contentUniqueness"
        }
    }

    given("질의 이해가 동행을 읽은 질의") {
        then("두 레그에 companions=KIDS 를 1.5 로 곱한다 — 거르지 않으므로 filter 절에는 없다") {
            val root = request(
                AttractionSearchPort.SearchQuery(keyword = "beach", lang = "en", embedding = vector, companion = AttractionCompanion.KIDS),
            )
            functionsOf(keywordLegOf(root)) shouldContain "companions=KIDS:1.5"
            functionsOf(vectorLegOf(root)) shouldContain "companions=KIDS:1.5"
            keywordLegOf(root)["function_score"]["query"].findValue("companions") shouldBe null
            vectorLegOf(root)["function_score"]["query"].findValue("companions") shouldBe null
        }
        then("동행이 없으면 동행 함수가 없고, 값을 1.0 으로 두면 동행이 있어도 넣지 않는다") {
            val plain = request(AttractionSearchPort.SearchQuery(keyword = "beach", lang = "en", embedding = vector))
            (functionsOf(keywordLegOf(plain)) + functionsOf(vectorLegOf(plain))).filter { it.startsWith("companions") }.shouldBeEmpty()
            val neutral = request(
                AttractionSearchPort.SearchQuery(lang = "en", embedding = vector, companion = AttractionCompanion.KIDS),
                AttractionRankingProperties(companionWeight = 1.0),
            )
            functionsOf(neutral["query"]).filter { it.startsWith("companions") }.shouldBeEmpty()
        }
    }
})
