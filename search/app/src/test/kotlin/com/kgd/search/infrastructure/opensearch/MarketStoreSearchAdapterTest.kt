package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.marketstore.usecase.SearchMarketStoreUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.mockk
import org.opensearch.client.opensearch.OpenSearchClient

class MarketStoreSearchAdapterTest : BehaviorSpec({
    val adapter = MarketStoreSearchAdapter(mockk<OpenSearchClient>())
    given("market scoped Korean query") {
        val request = adapter.request(SearchMarketStoreUseCase.Query("떡복이", "34550", size = 200))
        then("market filter and only name or roman fuzziness") {
            request.index() shouldBe listOf("market-stores")
            request.query()!!.bool().filter().single().term().value().stringValue() shouldBe "34550"
            request.query()!!.bool().should().forEach { clause ->
                val match = clause.match()
                match.fuzziness() shouldBe if (match.field() in listOf("name", "nameEn", "nameRoman")) "AUTO" else null
            }
            request.aggregations().isEmpty() shouldBe true
        }
    }
    given("ASCII English query with default Korean language") {
        then("English fields still get priority") {
            val request = adapter.request(SearchMarketStoreUseCase.Query("tteokbokki", lang = "ko"))
            val matches = request.query()!!.bool().should().associate { it.match().field() to it.match() }
            matches.getValue("nameEn").boost() shouldBe 8f
            matches.getValue("dishesEn").boost() shouldBe 6f
            matches.getValue("name").boost() shouldBe 4f
        }
    }
    given("English query without market") {
        val request = adapter.request(SearchMarketStoreUseCase.Query("tteokbokki", lang = "en"))
        then("English fields get priority; weights and all-market aggregation are present") {
            val matches = request.query()!!.bool().should().associate { it.match().field() to it.match() }
            matches.getValue("name").boost() shouldBe 4f
            matches.getValue("nameEn").boost() shouldBe 8f
            matches.getValue("dishes").boost() shouldBe 3f
            matches.getValue("items").boost() shouldBe 2f
            matches.getValue("menus").boost() shouldBe 2f
            matches.getValue("categorySub").boost() shouldBe 1f
            request.aggregations().containsKey("markets") shouldBe true
            request.query()!!.bool().filter().isEmpty() shouldBe true
        }
    }
})
