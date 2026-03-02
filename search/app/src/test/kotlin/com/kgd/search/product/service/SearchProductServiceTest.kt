package com.kgd.search.application.product.service

import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.port.ProductSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.math.BigDecimal

class SearchProductServiceTest : BehaviorSpec({
    val searchPort = mockk<ProductSearchPort>()
    val service = SearchProductService(searchPort)

    beforeEach { clearMocks(searchPort) }

    given("상품 검색 시") {
        `when`("키워드가 주어지면") {
            then("검색 결과가 반환되어야 한다") {
                val doc = ProductDocument("1", "테스트 상품", BigDecimal("10000"), "ACTIVE")
                val pageable = PageRequest.of(0, 20)
                every { searchPort.search("테스트", pageable) } returns PageImpl(listOf(doc), pageable, 1)

                val result = service.execute(SearchProductUseCase.Query("테스트", 0, 20))

                result.products.size shouldBe 1
                result.products[0].id shouldBe "1"
                result.products[0].name shouldBe "테스트 상품"
                result.totalElements shouldBe 1L
                result.totalPages shouldBe 1
                result.currentPage shouldBe 0
            }
        }
        `when`("결과가 없으면") {
            then("빈 결과가 반환되어야 한다") {
                val pageable = PageRequest.of(0, 20)
                every { searchPort.search("없는상품", pageable) } returns PageImpl(emptyList(), pageable, 0)

                val result = service.execute(SearchProductUseCase.Query("없는상품", 0, 20))

                result.products shouldBe emptyList()
                result.totalElements shouldBe 0L
            }
        }
    }
})
