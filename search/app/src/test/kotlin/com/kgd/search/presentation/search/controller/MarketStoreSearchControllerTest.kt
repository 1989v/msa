package com.kgd.search.presentation.search.controller

import com.kgd.common.exception.BusinessException
import com.kgd.search.application.marketstore.usecase.SearchMarketStoreUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import tools.jackson.databind.ObjectMapper
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

class MarketStoreSearchControllerTest : BehaviorSpec({
    given("market-store parameters") {
        val useCase = mockk<SearchMarketStoreUseCase>()
        every { useCase.search(any()) } returns SearchMarketStoreUseCase.Result(emptyList(), 0, emptyList())
        val controller = MarketStoreSearchController(useCase)
        then("market defaults to 200, all markets defaults to 20") {
            controller.search("가게", "34550", "ko", 0, null)
            controller.search("가게", null, "en", 0, null)
            verify { useCase.search(SearchMarketStoreUseCase.Query("가게", "34550", "ko", 0, 200)) }
            verify { useCase.search(SearchMarketStoreUseCase.Query("가게", null, "en", 0, 20)) }
        }
        then("reject blanks, long query, language, market id and invalid pagination") {
            shouldThrow<BusinessException> { controller.search(" ", null, "ko", 0, null) }
            shouldThrow<BusinessException> { controller.search("x".repeat(201), null, "ko", 0, null) }
            shouldThrow<BusinessException> { controller.search("x", null, "ja", 0, null) }
            shouldThrow<BusinessException> { controller.search("x", "bad", "ko", 0, null) }
            shouldThrow<BusinessException> { controller.search("x", null, "ko", -1, null) }
            shouldThrow<BusinessException> { controller.search("x", null, "ko", 0, 201) }
            shouldThrow<BusinessException> { controller.search("x", null, "ko", Int.MAX_VALUE, 200) }
        }
    }
    given("enriched discovery response") {
        then("serialize item display fields and market attraction references in the existing envelope") {
            val useCase = mockk<SearchMarketStoreUseCase>()
            every { useCase.search(any()) } returns SearchMarketStoreUseCase.Result(
                listOf(SearchMarketStoreUseCase.Item(2, "100", listOf("NAME"), 4.0, name = "가게", nameEn = "Shop",
                    address = "도로", goodPrice = true, goodPriceMenus = listOf("국수"), sources = listOf("ONNURI"),
                    attraction = SearchMarketStoreUseCase.Attraction(7, "ko"))), 1,
                listOf(SearchMarketStoreUseCase.Market("100", "시장", 1, region = "서울 중구", marketType = "STREET",
                    attraction = SearchMarketStoreUseCase.Attraction(7, "ko"))))
            val mapper = ObjectMapper()
            val body = mapper.readTree(mapper.writeValueAsString(MarketStoreSearchController(useCase).search("가게", null, "en", 0, null))).path("data")
            body.path("items").get(0).path("nameEn").asText() shouldBe "Shop"
            body.path("items").get(0).path("goodPriceMenus").get(0).asText() shouldBe "국수"
            body.path("items").get(0).path("attraction").path("lang").asText() shouldBe "ko"
            body.path("markets").get(0).path("region").asText() shouldBe "서울 중구"
            body.path("markets").get(0).path("attraction").path("id").asLong() shouldBe 7L
        }
    }

})
