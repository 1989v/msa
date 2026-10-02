package com.kgd.search.infrastructure.indexing

import tools.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.string.shouldContain
import org.opensearch.client.opensearch.core.CountRequest
import org.opensearch.client.opensearch.core.CountResponse
import org.opensearch.client.opensearch.indices.GetAliasResponse
import org.opensearch.client.opensearch.indices.GetIndexResponse
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.generic.Body
import org.opensearch.client.opensearch.generic.OpenSearchGenericClient
import org.opensearch.client.opensearch.generic.Request
import org.opensearch.client.opensearch.generic.Response
import org.opensearch.client.opensearch.indices.OpenSearchIndicesClient

class IndexAliasManagerTest : BehaviorSpec({
    val osClient = mockk<OpenSearchClient>(relaxed = true)
    val manager = IndexAliasManager(osClient)

    beforeEach { clearMocks(osClient) }

    given("타임스탬프 색인명 생성 시") {
        `when`("alias 이름이 주어지면") {
            then("alias_YYYYMMDDHHMMSS 형식이어야 한다") {
                val name = manager.createTimestampedIndexName("products")
                name shouldStartWith "products_"
                // "products_" = 9 chars, timestamp = 14 chars
                name.length shouldBe 9 + 14
            }
        }
    }

    given("두 번 색인명을 생성하면") {
        `when`("같은 alias로 호출하면") {
            then("각 이름은 같거나 다를 수 있지만 형식은 동일해야 한다") {
                val name1 = manager.createTimestampedIndexName("products")
                val name2 = manager.createTimestampedIndexName("products")
                name1 shouldStartWith "products_"
                name2 shouldStartWith "products_"
            }
        }
    }

    // 판정 근거는 관리자가 OpenSearch 에 실제로 보내는 요청 본문이다.
    // typed 모델로 파싱해 보내던 때는 모델에 없는 `synonym_analyzer` 가 말없이 빠져 색인 생성이 400 으로 죽었다.
    fun captureCreate(): io.mockk.CapturingSlot<Request> {
        val generic = mockk<OpenSearchGenericClient>()
        every { osClient.generic() } returns generic
        val sent = slot<Request>()
        val ok = mockk<Response>(relaxed = true)
        every { ok.status } returns 200
        every { generic.execute(capture(sent)) } returns ok
        return sent
    }
    fun bodyOf(request: Request) = ObjectMapper().readTree(request.body.get().bodyAsString())
    fun resource(path: String) = ObjectMapper().readTree(IndexAliasManager::class.java.getResourceAsStream(path))

    given("createIndex 시") {
        `when`("관광지 정의로 만들면") {
            then("정의 JSON 을 고치지 않고 PUT /{index} 로 보낸다 — 클라이언트 모델에 없는 키도 남는다") {
                val sent = captureCreate()

                manager.createIndex("attractions_test", IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION)

                sent.captured.method shouldBe "PUT"
                sent.captured.endpoint shouldBe "/attractions_test"
                val body = bodyOf(sent.captured)
                body shouldBe resource(IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION)
                body.at("/settings/analysis/filter/tourism_synonyms/synonym_analyzer").asString() shouldBe "nori_synonym_parse"
                body.at("/settings/analysis/tokenizer/nori_user/decompound_mode").asString() shouldBe "mixed"
            }
        }
        `when`("서버가 거부하면") {
            then("상태와 사유를 담아 실패한다 — 반쪽 색인으로 진행하지 않는다") {
                val generic = mockk<OpenSearchGenericClient>()
                every { osClient.generic() } returns generic
                val bad = mockk<Response>(relaxed = true)
                every { bad.status } returns 400
                every { bad.body } returns java.util.Optional.of<Body>(Body.from("Failed to build analyzers".toByteArray(), "application/json")!!)
                every { generic.execute(any()) } returns bad

                val e = shouldThrow<IllegalStateException> { manager.createIndex("attractions_test", IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION) }
                e.message shouldContain "400"
                e.message shouldContain "Failed to build analyzers"
            }
        }
    }

    // 운영은 OpenSearch 단일 노드다. 선언이 없으면 서버 기본값(레플리카 1)이 들어가 복제본을
    // 둘 곳이 없어 클러스터가 상시 yellow 가 되고, 진짜 장애 신호와 구분이 안 된다.
    // 프라이머리 1 은 단일 노드에서 fan-out 이 없는 유일한 값이다 (샤드당 270MB, 권장 20~50GB).
    given("색인 정의 4종의 샤드 설정") {
        listOf(
            IndexAliasManager.PRODUCTS_INDEX_DEFINITION,
            IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION,
            IndexAliasManager.REGIONS_INDEX_DEFINITION,
            IndexAliasManager.UNIFIED_INDEX_DEFINITION,
        ).forEach { definition ->
            `when`("$definition 으로 createIndex 하면") {
                then("프라이머리 1 · 레플리카 0 이 요청에 명시되어야 한다") {
                    val sent = captureCreate()

                    manager.createIndex("contract_test", definition)

                    val index = bodyOf(sent.captured).at("/settings/index")
                    index.get("number_of_shards").asInt() shouldBe 1
                    index.get("number_of_replicas").asInt() shouldBe 0
                }
            }
        }
    }

    // 별칭 교체 게이트 — 판정 근거는 이 관리자가 OpenSearch 에 실제로 보내는 요청(updateAliases · delete)이다.
    // 색인 도중 OOM 으로 벌크가 수천 건 죽은 반쪽 색인(45,535 / 59,735)이 라이브가 된 사고의 재현.
    given("별칭 교체 게이트") {
        fun wire(live: Map<String, Long>, newIndex: String, newCount: Long): OpenSearchIndicesClient {
            val indices = mockk<OpenSearchIndicesClient>(relaxed = true)
            every { osClient.indices() } returns indices
            val aliasResp = mockk<GetAliasResponse>()
            every { aliasResp.result() } returns live.keys.associateWith { mockk(relaxed = true) }
            if (live.isEmpty()) {
                every { indices.getAlias(any<java.util.function.Function<*, *>>() as java.util.function.Function<org.opensearch.client.opensearch.indices.GetAliasRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.GetAliasRequest>>) } throws RuntimeException("alias 없음")
            } else {
                every { indices.getAlias(any<java.util.function.Function<org.opensearch.client.opensearch.indices.GetAliasRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.GetAliasRequest>>>()) } returns aliasResp
            }
            val getResp = mockk<GetIndexResponse>()
            every { getResp.result() } returns (live.keys + newIndex).associateWith { mockk(relaxed = true) }
            every { indices.get(any<java.util.function.Function<org.opensearch.client.opensearch.indices.GetIndexRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.GetIndexRequest>>>()) } returns getResp
            val counts = live + (newIndex to newCount)
            every { osClient.count(any<CountRequest>()) } answers {
                val index = firstArg<CountRequest>().index().single()
                mockk<CountResponse> { every { count() } returns counts.getValue(index) }
            }
            return indices
        }

        `when`("새 색인이 라이브의 90% 에 못 미치면 (45,535 / 59,735)") {
            then("별칭을 넘기지 않고 새 색인을 지운 뒤 예외를 던진다") {
                val indices = wire(mapOf("attractions_old" to 59_735L), "attractions_new", 45_535L)
                val e = shouldThrow<IllegalStateException> {
                    manager.updateAliasAndCleanup("attractions", "attractions_new", maxRetention = 1)
                }
                e.message!! shouldContain "교체 거부"
                verify(exactly = 0) { indices.updateAliases(any<java.util.function.Function<org.opensearch.client.opensearch.indices.UpdateAliasesRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.UpdateAliasesRequest>>>()) }
                verify(exactly = 1) { indices.delete(any<java.util.function.Function<org.opensearch.client.opensearch.indices.DeleteIndexRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.DeleteIndexRequest>>>()) }
            }
        }
        `when`("새 색인이 라이브와 같은 건수면") {
            then("별칭을 넘긴다") {
                val indices = wire(mapOf("attractions_old" to 59_735L), "attractions_new", 59_735L)
                manager.updateAliasAndCleanup("attractions", "attractions_new", maxRetention = 1)
                verify(exactly = 1) { indices.updateAliases(any<java.util.function.Function<org.opensearch.client.opensearch.indices.UpdateAliasesRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.UpdateAliasesRequest>>>()) }
            }
        }
        `when`("라이브 색인이 없는 첫 색인이면") {
            then("건수가 있으면 별칭을 넘긴다") {
                val indices = wire(emptyMap(), "unified_new", 351L)
                manager.updateAliasAndCleanup("unified", "unified_new")
                verify(exactly = 1) { indices.updateAliases(any<java.util.function.Function<org.opensearch.client.opensearch.indices.UpdateAliasesRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.UpdateAliasesRequest>>>()) }
            }
        }
        `when`("새 색인이 비어 있으면") {
            then("라이브가 없어도 넘기지 않는다") {
                val indices = wire(emptyMap(), "unified_new", 0L)
                shouldThrow<IllegalStateException> { manager.updateAliasAndCleanup("unified", "unified_new") }
                verify(exactly = 0) { indices.updateAliases(any<java.util.function.Function<org.opensearch.client.opensearch.indices.UpdateAliasesRequest.Builder, org.opensearch.client.util.ObjectBuilder<org.opensearch.client.opensearch.indices.UpdateAliasesRequest>>>()) }
            }
        }
    }
})
