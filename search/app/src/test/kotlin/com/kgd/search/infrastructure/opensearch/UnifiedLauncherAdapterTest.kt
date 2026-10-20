package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.unified.port.UnifiedSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.*
import org.opensearch.client.opensearch.core.search.TotalHitsRelation

class UnifiedLauncherAdapterTest : BehaviorSpec({
    fun response() = SearchResponse.Builder<UnifiedSearchDocument>().took(1).timedOut(false)
        .shards { it.total(1).successful(1).failed(0) }.hits { it.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }.build()
    given("name suggest and grouped pagination") {
        then("suggest uses exact then prefix keyword legs, Latin case-insensitive, no vectors and stable id tie") {
            val client = mockk<OpenSearchClient>(); val sent = slot<SearchRequest>()
            every { client.search(capture(sent), UnifiedSearchDocument::class.java) } returns response()
            UnifiedSearchAdapter(client).suggest("amp", "game", 8)
            val q = sent.captured.query()!!.bool()
            q.filter().single().term().value().stringValue() shouldBe "game"
            q.should()[0].constantScore().boost() shouldBe 1000f
            q.should()[0].constantScore().filter().term().caseInsensitive() shouldBe true
            q.should()[1].constantScore().filter().prefix().caseInsensitive() shouldBe true
            sent.captured.searchPipeline() shouldBe null
            sent.captured.sort().last().field().field() shouldBe "id"
        }
        then("page is applied to the existing unified index without changing its document contract") {
            val client = mockk<OpenSearchClient>(); val sent = slot<SearchRequest>()
            every { client.search(capture(sent), UnifiedSearchDocument::class.java) } returns response()
            UnifiedSearchAdapter(client).search(UnifiedSearchPort.Query("game", "game", size = 20, page = 2))
            sent.captured.from() shouldBe 40
            sent.captured.index() shouldBe listOf("unified")
        }
    }
})
