package com.kgd.search.presentation.search.controller

import com.kgd.common.exception.BusinessException
import com.kgd.search.application.marketstore.usecase.SearchMarketStoreUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
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
})
