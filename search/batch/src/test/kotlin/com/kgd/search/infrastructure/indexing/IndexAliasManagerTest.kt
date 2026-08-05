package com.kgd.search.infrastructure.indexing

import com.fasterxml.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.maps.shouldContainKey
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.opensearch.client.json.jackson.JacksonJsonpMapper
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
                every { transport.jsonpMapper() } returns JacksonJsonpMapper(ObjectMapper())
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
})
