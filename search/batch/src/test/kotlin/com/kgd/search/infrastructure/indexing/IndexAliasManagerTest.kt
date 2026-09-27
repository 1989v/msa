package com.kgd.search.infrastructure.indexing

import tools.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.maps.shouldContainKey
import io.kotest.matchers.nulls.shouldNotBeNull
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
import org.opensearch.client.json.jackson3.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.mapping.Property
import org.opensearch.client.opensearch.indices.CreateIndexRequest
import org.opensearch.client.opensearch.indices.OpenSearchIndicesClient
import org.opensearch.client.transport.OpenSearchTransport

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

    // 회귀: opensearch-java 3.8 의 JacksonJsonProvider.createReader 는
    // UnsupportedOperationException — DOM reader 기반 구현이면 본 테스트가 그 예외로 실패한다.
    given("createIndex 시 (실제 JacksonJsonpMapper 파싱)") {
        `when`("products-index.json 정의를 로드하면") {
            then("settings(nori)/mappings(영양 포함)가 typed 로 파싱되어 요청에 실려야 한다") {
                val transport = mockk<OpenSearchTransport>()
                every { osClient._transport() } returns transport
                every { transport.jsonpMapper() } returns JacksonJsonpMapper()
                val indices = mockk<OpenSearchIndicesClient>()
                every { osClient.indices() } returns indices
                val requestSlot = slot<CreateIndexRequest>()
                every { indices.create(capture(requestSlot)) } returns mockk(relaxed = true)

                manager.createIndex("products_test")

                val request = requestSlot.captured
                request.index() shouldBe "products_test"

                val props = request.mappings().shouldNotBeNull().properties()
                props shouldContainKey "name"
                props shouldContainKey "energyKcal"
                props shouldContainKey "ingredients"
                props["energyKcal"]!!._kind() shouldBe Property.Kind.Double
                props["itemReportNo"]!!._kind() shouldBe Property.Kind.Keyword

                val analyzers = request.settings().shouldNotBeNull()
                    .analysis().shouldNotBeNull().analyzer()
                analyzers shouldContainKey "nori_analyzer"
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
                    val transport = mockk<OpenSearchTransport>()
                    every { osClient._transport() } returns transport
                    every { transport.jsonpMapper() } returns JacksonJsonpMapper()
                    val indices = mockk<OpenSearchIndicesClient>()
                    every { osClient.indices() } returns indices
                    val requestSlot = slot<CreateIndexRequest>()
                    every { indices.create(capture(requestSlot)) } returns mockk(relaxed = true)

                    manager.createIndex("contract_test", definition)

                    // 정의 JSON 은 settings.index.* 중첩형이라 typed 로는 settings().index() 에 실린다
                    val index = requestSlot.captured.settings().shouldNotBeNull().index().shouldNotBeNull()
                    index.numberOfShards() shouldBe 1
                    index.numberOfReplicas() shouldBe 0
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
