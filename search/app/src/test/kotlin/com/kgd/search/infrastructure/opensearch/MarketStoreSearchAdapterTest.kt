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
    given("display rows and filtered sources") {
        then("map all item metadata, prefer road address, and fall back to Korean attractions") {
            val doc = MarketStoreSearchDocument(storeId = 2, contentId = "100", name = "국수", nameEn = "Noodles",
                categorySub = "한식", categorySubEn = "Korean", roadAddress = "도로", jibunAddress = "지번",
                buildingName = "상가", dong = "A", floor = "2", ho = "201", goodPrice = true,
                goodPriceMenus = listOf("국수"), sources = listOf("ONNURI"), marketName = "시장", attractionIdKo = 7, attractionIdEn = 8)
            val item = adapter.item(doc, listOf("NAME_name", "NAME_nameEn"), 4.0, "en")
            item.name shouldBe "국수"
            item.nameEn shouldBe "Noodles"
            item.address shouldBe "도로"
            item.categorySubEn shouldBe "Korean"
            item.goodPriceMenus shouldBe listOf("국수")
            item.sources shouldBe listOf("ONNURI")
            item.attraction shouldBe SearchMarketStoreUseCase.Attraction(8, "en")
            item.matchedBy shouldBe listOf("NAME")
            val fallback = adapter.item(doc.copy(roadAddress = " ", attractionIdEn = null), emptyList(), 0.0, "en")
            fallback.address shouldBe "지번"
            fallback.attraction shouldBe SearchMarketStoreUseCase.Attraction(7, "ko")
            adapter.item(doc.copy(attractionIdKo = null, attractionIdEn = null), emptyList(), 0.0, "en").attraction shouldBe null
        }
        then("fetch only required item fields and bounded per-market metadata") {
            val request = adapter.request(SearchMarketStoreUseCase.Query("국수"))
            request.source()!!.filter().includes() shouldBe MarketStoreSearchAdapter.ITEM_FIELDS
            request.source()!!.filter().includes().contains("menus") shouldBe false
            val metadata = request.aggregations().getValue("markets").aggregations().getValue("metadata").topHits()
            metadata.size() shouldBe 1
            metadata.source()!!.filter().includes() shouldBe MarketStoreSearchAdapter.MARKET_FIELDS
        }
    }

})
