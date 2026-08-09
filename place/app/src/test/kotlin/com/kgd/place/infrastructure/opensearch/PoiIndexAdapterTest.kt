package com.kgd.place.infrastructure.opensearch

import com.fasterxml.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.opensearch.client.json.jackson.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.ErrorCause
import org.opensearch.client.opensearch._types.ErrorResponse
import org.opensearch.client.opensearch._types.OpenSearchException
import org.opensearch.client.opensearch.indices.CreateIndexRequest
import org.opensearch.client.opensearch.indices.CreateIndexResponse
import org.opensearch.client.opensearch.indices.ExistsRequest
import org.opensearch.client.opensearch.indices.OpenSearchIndicesClient
import org.opensearch.client.transport.OpenSearchTransport
import org.opensearch.client.transport.endpoints.BooleanResponse
import org.opensearch.client.util.ObjectBuilder
import java.util.function.Function

private typealias ExistsFn = Function<ExistsRequest.Builder, ObjectBuilder<ExistsRequest>>
private typealias CreateFn = Function<CreateIndexRequest.Builder, ObjectBuilder<CreateIndexRequest>>

private fun osError(status: Int, type: String) = OpenSearchException(
    ErrorResponse.of { r -> r.status(status).error(ErrorCause.of { c -> c.type(type).reason(type) }) }
)

class PoiIndexAdapterTest : BehaviorSpec({

    lateinit var indices: OpenSearchIndicesClient
    lateinit var adapter: PoiIndexAdapter

    beforeTest {
        indices = mockk(relaxed = true)
        // create 경로는 poi-index.json 을 transport 의 JsonpMapper 로 파싱한다 → 실물 매퍼가 필요.
        val transport = mockk<OpenSearchTransport> { every { jsonpMapper() } returns JacksonJsonpMapper() }
        val client = mockk<OpenSearchClient> {
            every { indices() } returns indices
            every { _transport() } returns transport
        }
        adapter = PoiIndexAdapter(client, ObjectMapper(), "poi")
    }

    Given("poi 인덱스가 없을 때") {
        When("ensureIndex 를 호출하면") {
            Then("404 를 '없음'으로 읽고 인덱스를 생성한다") {
                // exists() 는 없는 인덱스에 false 가 아니라 404 예외를 던진다.
                // 이걸 삼키지 못하면 create 에 도달하지 못해 인덱스가 영영 생기지 않는다.
                every { indices.exists(any<ExistsFn>()) } throws osError(404, "index_not_found_exception")
                every { indices.create(any<CreateFn>()) } returns mockk<CreateIndexResponse>()

                adapter.ensureIndex()

                verify(exactly = 1) { indices.create(any<CreateFn>()) }
            }
        }
    }

    Given("poi 인덱스가 이미 있을 때") {
        When("ensureIndex 를 호출하면") {
            Then("생성하지 않는다") {
                every { indices.exists(any<ExistsFn>()) } returns BooleanResponse(true)

                adapter.ensureIndex()

                verify(exactly = 0) { indices.create(any<CreateFn>()) }
            }
        }
    }

    Given("404 가 아닌 OpenSearch 오류일 때") {
        When("ensureIndex 를 호출하면") {
            Then("삼키지 않고 전파한다") {
                every { indices.exists(any<ExistsFn>()) } throws osError(503, "cluster_block_exception")

                runCatching { adapter.ensureIndex() }.isFailure shouldBe true
                verify(exactly = 0) { indices.create(any<CreateFn>()) }
            }
        }
    }
})
