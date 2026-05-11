package com.kgd.search.application.product.service

import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.bandit.BanditProperties
import com.kgd.search.bandit.ThompsonReranker
import com.kgd.search.domain.bandit.port.BanditStatePort
import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.model.ScoredProductDocument
import com.kgd.search.domain.product.port.ProductSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.math.BigDecimal

class SearchProductServiceTest : BehaviorSpec({
    val searchPort = mockk<ProductSearchPort>()
    val banditStatePort = mockk<BanditStatePort>()
    every { banditStatePort.fetchBatch(any()) } returns emptyMap()
    val reranker = ThompsonReranker(BanditProperties(enabled = false), banditStatePort)
    val service = SearchProductService(searchPort, reranker)

    beforeEach { clearMocks(searchPort) }

    given("상품 검색 시") {
        `when`("키워드가 주어지면") {
            then("검색 결과가 반환되고 searchId 가 동봉되어야 한다") {
                val doc = ProductDocument("1", "테스트 상품", BigDecimal("10000"), "ACTIVE", categoryId = "elec")
                val pageable = PageRequest.of(0, 20)
                every { searchPort.searchScored("테스트", pageable) } returns
                    PageImpl(listOf(ScoredProductDocument(doc, 3.5)), pageable, 1)

                val result = service.execute(SearchProductUseCase.Query("테스트", 0, 20))

                result.products.size shouldBe 1
                result.products[0].id shouldBe "1"
                result.products[0].name shouldBe "테스트 상품"
                result.products[0].categoryId shouldBe "elec"
                result.totalElements shouldBe 1L
                result.totalPages shouldBe 1
                result.currentPage shouldBe 0
                result.searchId.isNotEmpty() shouldBe true
            }
        }
        `when`("결과가 없으면") {
            then("빈 결과가 반환되어야 한다") {
                val pageable = PageRequest.of(0, 20)
                every { searchPort.searchScored("없는상품", pageable) } returns PageImpl(emptyList(), pageable, 0)

                val result = service.execute(SearchProductUseCase.Query("없는상품", 0, 20))

                result.products.shouldBeEmpty()
                result.totalElements shouldBe 0L
            }
        }
    }
})
