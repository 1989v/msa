package com.kgd.analytics.application.usecase

import com.kgd.analytics.domain.model.ProductScore
import com.kgd.analytics.domain.port.ProductScoreRepositoryPort
import com.kgd.analytics.domain.port.ScoreCachePort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.Instant

class GetProductScoreUseCaseTest : BehaviorSpec({
    val cache = mockk<ScoreCachePort>(relaxed = true)
    val repository = mockk<ProductScoreRepositoryPort>()
    val useCase = GetProductScoreUseCase(cache, repository)

    val productScore = ProductScore(
        productId = 1L, impressions = 100, clicks = 10, orders = 1,
        ctr = 0.1, cvr = 0.1, popularityScore = 0.5, updatedAt = Instant.now()
    )

    Given("상품 스코어 조회") {
        When("Redis 캐시에 있으면") {
            every { cache.getProductScore(1L) } returns productScore

            val result = useCase.execute(1L)

            Then("캐시에서 반환하고 DB를 조회하지 않는다") {
                result shouldBe productScore
                verify(exactly = 0) { repository.findByProductId(any()) }
            }
        }

        When("캐시 miss이면") {
            every { cache.getProductScore(2L) } returns null
            every { repository.findByProductId(2L) } returns productScore.copy(productId = 2L)

            val result = useCase.execute(2L)

            Then("DB에서 조회하고 캐시에 저장한다") {
                result?.productId shouldBe 2L
                verify { cache.cacheProductScore(any()) }
            }
        }

        When("캐시 miss이고 DB에도 없으면") {
            every { cache.getProductScore(999L) } returns null
            every { repository.findByProductId(999L) } returns null

            val result = useCase.execute(999L)

            Then("null을 반환한다") {
                result shouldBe null
            }
        }
    }

    Given("벌크 상품 스코어 조회") {
        When("모든 ID가 캐시에 있으면") {
            every { cache.getProductScores(listOf(1L, 2L)) } returns listOf(
                productScore, productScore.copy(productId = 2L)
            )

            val result = useCase.executeBulk(listOf(1L, 2L))

            Then("DB를 조회하지 않는다") {
                result.size shouldBe 2
                verify(exactly = 0) { repository.findByProductIds(any()) }
            }
        }
    }
})
