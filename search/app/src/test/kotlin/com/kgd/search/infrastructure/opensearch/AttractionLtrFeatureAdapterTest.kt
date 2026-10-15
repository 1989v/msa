package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.port.LtrRetrievalFeatures
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.generic.Body
import org.opensearch.client.opensearch.generic.OpenSearchGenericClient
import org.opensearch.client.opensearch.generic.Request
import org.opensearch.client.opensearch.generic.Response
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.util.Optional

class AttractionLtrFeatureAdapterTest : BehaviorSpec({
    val mapper = JsonMapper.builder().build()
    val client = mockk<OpenSearchClient>()
    val generic = mockk<OpenSearchGenericClient>()
    every { client.generic() } returns generic
    val adapter = AttractionLtrFeatureAdapter(client, mapper, QueryVectorProperties(modelRef = "m@1"))

    fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }

    fun hits(vararg idScore: Pair<String, Double>) =
        """{"hits":{"hits":[${idScore.joinToString(",") { """{"_id":"${it.first}","_score":${it.second}}""" }}]}}"""

    fun respond(status: Int, body: String): io.mockk.CapturingSlot<Request> {
        val sent = slot<Request>()
        val response = mockk<Response>(relaxed = true)
        every { response.status } returns status
        every { response.body } returns Optional.of(Body.from(body.toByteArray(), "application/json")!!)
        every { generic.execute(capture(sent)) } returns response
        return sent
    }

    given("요청") {
        `when`("후보 셋의 피처를 물으면") {
            then("BM25 단독 · 벡터 이웃 · 필드별 점수 다섯을 한 msearch 로 보낸다") {
                val body = adapter.requestBody("경복궁 야경", "ko", listOf(0.5f), listOf("a", "b", "c"))
                val lines = body.trimEnd('\n').split('\n')
                lines.size shouldBe 14
                val searches = lines.filterIndexed { i, _ -> i % 2 == 1 }.map { mapper.readTree(it) }
                // BM25 단독은 언어 필터 + 앱과 같은 가중 필드, 상위 20
                searches[0].path("size").asInt() shouldBe 20
                searches[0].path("query").path("bool").path("filter")[0].path("term").path("lang").asString() shouldBe "ko"
                searches[0].path("query").path("bool").path("must")[0].path("multi_match").path("fields").items().map { it.asString() } shouldBe
                    listOf("title^3", "title.en^3", "titleLocal^3", "overview", "overview.en", "address", "address.en")
                // 벡터 이웃 100, 언어 + 모델 스탬프 필터
                val knn = searches[1].path("query").path("knn").path("embedding")
                knn.path("k").asInt() shouldBe 100
                knn.path("filter").path("bool").path("filter")[1].path("term").path("embeddingModel").asString() shouldBe "m@1"
                // 점수 질의는 후보로만 좁히고 문구 일치는 제목 필드에 phrase
                searches.drop(2).forEach { it.path("query").path("bool").path("filter")[0].path("ids").path("values").items().map { v -> v.asString() } shouldBe listOf("a", "b", "c") }
                searches[6].path("query").path("bool").path("must")[0].path("multi_match").path("type").asString() shouldBe "phrase"
            }
        }
    }

    given("응답") {
        `when`("일곱 응답이 모두 오면") {
            then("순위는 상위 20 안의 자리, 없으면 20 이고 B 는 두 레그의 RRF 순위다") {
                val sent = respond(
                    200,
                    """{"responses":[
                        ${hits("a" to 9.0, "b" to 8.0)},
                        ${hits("c" to 0.9, "a" to 0.8)},
                        ${hits("a" to 3.0)}, ${hits("b" to 2.0)}, ${hits()}, ${hits("a" to 7.0, "b" to 6.0)}, ${hits("a" to 1.5)}
                    ]}""",
                )

                val f = adapter.features("경복궁", "ko", listOf(0.1f), listOf("a", "b", "c", "d"))

                sent.captured.endpoint shouldBe "/attractions/_msearch"
                // RRF: a = 1/61 + 1/62, c = 1/61, b = 1/62 → a, c, b
                f["a"] shouldBe LtrRetrievalFeatures(aRank = 0, bRank = 0, bmTitle = 3.0, bmAll = 7.0, phraseTitle = 1.5, knn = 0.8)
                f["c"] shouldBe LtrRetrievalFeatures(aRank = 20, bRank = 1, knn = 0.9)
                f["b"] shouldBe LtrRetrievalFeatures(aRank = 1, bRank = 2, bmOverview = 2.0, bmAll = 6.0)
                f["d"] shouldBe LtrRetrievalFeatures()
            }
        }
        `when`("하나라도 오류면") {
            then("예외를 던진다 — 빈 피처로 채점하지 않는다") {
                respond(200, """{"responses":[{"error":{"reason":"boom"}},${hits()},${hits()},${hits()},${hits()},${hits()},${hits()}]}""")
                shouldThrow<IllegalStateException> { adapter.features("경복궁", "ko", listOf(0.1f), listOf("a")) }.message shouldContain "boom"
            }
        }
        `when`("상태가 실패면") {
            then("예외를 던진다") {
                respond(503, "{}")
                shouldThrow<IllegalStateException> { adapter.features("경복궁", "ko", listOf(0.1f), listOf("a")) }.message shouldContain "503"
            }
        }
    }
})
