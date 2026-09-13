package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.unified.port.UnifiedSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation

/** 실제 순위는 OpenSearch 가 정하므로 **질의가 어떤 모양으로 나가는지**만 못 박는다. */
class UnifiedSearchAdapterTest : BehaviorSpec({

    fun <T> emptyResponse(): SearchResponse<T> =
        SearchResponse.Builder<T>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h -> h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
            .build()

    fun captured(query: UnifiedSearchPort.Query): SearchRequest {
        val client = mockk<OpenSearchClient>()
        val slot = slot<SearchRequest>()
        every { client.search(capture(slot), UnifiedSearchDocument::class.java) } returns emptyResponse()
        UnifiedSearchAdapter(client).search(query)
        return slot.captured
    }

    given("키워드 있는 타입 검색") {
        val request = captured(UnifiedSearchPort.Query(keyword = "하이브리드", type = "blog_post", size = 5))

        then("unified 인덱스에 type 필터 + multi_match, 본문은 응답에서 뺀다") {
            request.index() shouldContain "unified"
            val bool = requireNotNull(request.query()!!.functionScore().query()).bool()
            bool.must().single().isMultiMatch shouldBe true
            bool.filter().single().term().field() shouldBe "type"
            request.source()!!.filter().excludes() shouldContain "body"
            request.size() shouldBe 5
        }
    }

    given("타입 의도어만으로 된 질의 — 키워드 없음") {
        val request = captured(UnifiedSearchPort.Query(keyword = null, type = "game", size = 5))

        then("match_all + 인기순 정렬") {
            val bool = requireNotNull(request.query()!!.functionScore().query()).bool()
            bool.must().single().isMatchAll shouldBe true
            request.sort().single().field().field() shouldBe "popularity"
        }
    }

    given("facets 필터") {
        val request = captured(UnifiedSearchPort.Query(keyword = "퍼즐", type = "game", facets = mapOf("genre" to "PUZZLE"), size = 5))

        then("facets.genre term 필터로 나간다") {
            val bool = requireNotNull(request.query()!!.functionScore().query()).bool()
            bool.filter().map { it.term().field() } shouldContain "facets.genre"
        }
    }
})
