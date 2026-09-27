package com.kgd.codedictionary.infrastructure.opensearch.adapter

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.indices.CreateIndexRequest
import org.opensearch.client.opensearch.indices.CreateIndexResponse
import org.opensearch.client.opensearch.indices.OpenSearchIndicesClient
import org.opensearch.client.util.ObjectBuilder
import java.util.function.Function

/**
 * 운영 OpenSearch 는 노드가 하나다. 레플리카를 선언하지 않으면 서버 기본값 1 이 들어가 복제본을 둘
 * 곳이 없어 클러스터가 상시 yellow 가 된다 — 2026-09-25 개념 재색인이 실제로 그렇게 만들었다.
 * 판정 근거는 이름이나 문자열이 아니라 **대상이 조립한 CreateIndexRequest** 다: createIndex 가 넘긴
 * 빌더 람다를 그대로 실행해 나온 요청에서 값을 읽는다.
 */
class IndexAliasManagerTest : BehaviorSpec({
    given("개념 색인 생성") {
        `when`("createIndex 를 부르면") {
            val osClient = mockk<OpenSearchClient>()
            val indices = mockk<OpenSearchIndicesClient>()
            every { osClient.indices() } returns indices
            val builderFn = slot<Function<CreateIndexRequest.Builder, ObjectBuilder<CreateIndexRequest>>>()
            every { indices.create(capture(builderFn)) } returns mockk<CreateIndexResponse>(relaxed = true)

            IndexAliasManager(osClient).createIndex("concept-index_test")
            val request = builderFn.captured.apply(CreateIndexRequest.Builder()).build()

            then("프라이머리 1 · 레플리카 0 이 요청에 명시된다") {
                val settings = request.settings().shouldNotBeNull()
                settings.numberOfShards() shouldBe 1
                settings.numberOfReplicas() shouldBe 0
            }

            then("분석기 설정은 그대로 실린다") {
                request.index() shouldBe "concept-index_test"
                request.settings().shouldNotBeNull().analysis().shouldNotBeNull()
                    .analyzer().keys shouldBe setOf(
                    "concept_analyzer", "concept_search_analyzer",
                    "autocomplete_analyzer", "autocomplete_search_analyzer",
                )
            }
        }
    }
})
