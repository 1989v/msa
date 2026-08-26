package com.kgd.search.application.product.service

import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.bandit.BanditProperties
import com.kgd.search.bandit.DiversityProperties
import com.kgd.search.bandit.MultiScopeBanditBlender
import com.kgd.search.bandit.SellerDiversityReranker
import com.kgd.search.bandit.ThompsonReranker
import com.kgd.search.domain.bandit.port.BanditStatePort
import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.model.ScoredProductDocument
import com.kgd.search.application.product.usecase.SuggestProductUseCase
import com.kgd.search.domain.product.port.ProductSearchPort
import com.kgd.search.infrastructure.client.SearchExperimentClient
import com.kgd.search.infrastructure.client.SearchExperimentProperties
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.math.BigDecimal

class SearchProductServiceTest : BehaviorSpec({
    val searchPort = mockk<ProductSearchPort>()
    val banditStatePort = mockk<BanditStatePort>()
    every { banditStatePort.fetchBatch(any()) } returns emptyMap()
    val banditProps = BanditProperties(enabled = false)
    val reranker = ThompsonReranker(banditProps, MultiScopeBanditBlender(banditProps, banditStatePort))
    val diversity = SellerDiversityReranker(DiversityProperties(enabled = false))
    val experimentClient = mockk<SearchExperimentClient>()

    fun service(experimentEnabled: Boolean = false) = SearchProductService(
        searchPort, reranker, diversity,
        experimentClient,
        SearchExperimentProperties(enabled = experimentEnabled, id = 1L),
    )

    beforeEach { clearMocks(searchPort, experimentClient) }

    given("상품 검색 시") {
        `when`("키워드가 주어지면") {
            then("검색 결과가 반환되고 searchId 가 동봉되어야 한다") {
                val doc = ProductDocument("1", "테스트 상품", BigDecimal("10000"), "ACTIVE", categoryId = "elec")
                val pageable = PageRequest.of(0, 20)
                every { searchPort.searchScored("테스트", pageable, null) } returns
                    PageImpl(listOf(ScoredProductDocument(doc, 3.5)), pageable, 1)

                val result = service().execute(SearchProductUseCase.Query("테스트", 0, 20))

                result.products.size shouldBe 1
                result.products[0].id shouldBe "1"
                result.products[0].name shouldBe "테스트 상품"
                result.products[0].categoryId shouldBe "elec"
                result.totalElements shouldBe 1L
                result.totalPages shouldBe 1
                result.currentPage shouldBe 0
                result.searchId.isNotEmpty() shouldBe true
                result.variant.shouldBeNull()
            }
        }
        `when`("결과가 없으면") {
            then("빈 결과가 반환되어야 한다") {
                val pageable = PageRequest.of(0, 20)
                every { searchPort.searchScored("없는상품", pageable, null) } returns PageImpl(emptyList(), pageable, 0)

                val result = service().execute(SearchProductUseCase.Query("없는상품", 0, 20))

                result.products.shouldBeEmpty()
                result.totalElements shouldBe 0L
            }
        }
    }

    // 온라인 A/B — experiment 서비스 variant 할당
    given("온라인 A/B 활성 상태에서 검색 시") {
        `when`("로그인 사용자(userId)가 주어지면") {
            then("variant 가 할당되어 port 로 전달되고 결과에 태깅되어야 한다") {
                val pageable = PageRequest.of(0, 20)
                every { experimentClient.getVariant(1L, "user-1") } returns "experiment_a"
                every { searchPort.searchScored("테스트", pageable, "experiment_a") } returns
                    PageImpl(emptyList(), pageable, 0)

                val result = service(experimentEnabled = true)
                    .execute(SearchProductUseCase.Query("테스트", 0, 20, userId = "user-1"))

                result.variant shouldBe "experiment_a"
                verify(exactly = 1) { searchPort.searchScored("테스트", pageable, "experiment_a") }
            }
        }
        `when`("비로그인 사용자(userId=null)면") {
            then("experiment 호출 없이 기본 ranking 으로 동작해야 한다") {
                val pageable = PageRequest.of(0, 20)
                every { searchPort.searchScored("테스트", pageable, null) } returns PageImpl(emptyList(), pageable, 0)

                val result = service(experimentEnabled = true)
                    .execute(SearchProductUseCase.Query("테스트", 0, 20, userId = null))

                result.variant.shouldBeNull()
                verify(exactly = 0) { experimentClient.getVariant(any(), any()) }
            }
        }
        `when`("experiment 서비스 호출이 실패(null)하면") {
            then("기본 ranking 으로 graceful degrade 해야 한다") {
                val pageable = PageRequest.of(0, 20)
                every { experimentClient.getVariant(1L, "user-1") } returns null
                every { searchPort.searchScored("테스트", pageable, null) } returns PageImpl(emptyList(), pageable, 0)

                val result = service(experimentEnabled = true)
                    .execute(SearchProductUseCase.Query("테스트", 0, 20, userId = "user-1"))

                result.variant.shouldBeNull()
            }
        }
    }

    given("상품명 자동완성 시") {
        `when`("prefix 가 주어지면") {
            then("port 의 suggest 결과가 (id, name) 으로 매핑되어야 한다") {
                every { searchPort.suggest("노트", 8) } returns listOf(
                    ProductDocument("1", "노트북 거치대", BigDecimal("20000"), "ACTIVE"),
                    ProductDocument("2", "노트북 파우치", BigDecimal("15000"), "ACTIVE"),
                )

                val result = service().execute("노트", 8)

                result.size shouldBe 2
                result[0] shouldBe SuggestProductUseCase.Suggestion("1", "노트북 거치대")
                result[1].name shouldBe "노트북 파우치"
            }
        }
    }
})
