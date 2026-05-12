package com.kgd.recommendation.application.usecase

import com.kgd.recommendation.port.RecommendationRepository
import com.kgd.recommendation.recommendation.Recommendation
import com.kgd.recommendation.recommendation.RecommendationContext
import com.kgd.recommendation.recommendation.RecommendationItem
import com.kgd.recommendation.recommendation.RecommendationType
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import java.time.Instant

class GetCategoryBestUseCaseTest : BehaviorSpec({

    val repository = mockk<RecommendationRepository>()
    val useCase = GetCategoryBestUseCase(repository)

    given("city=1, category=10, limit=20 으로 호출") {
        every { repository.findCategoryBest(1, 10, 20) } returns Recommendation(
            type = RecommendationType.CATEGORY_BEST,
            userId = null,
            context = RecommendationContext(cityId = 1, categoryId = 10),
            items = listOf(
                RecommendationItem(itemId = 1001, score = 1000.0, source = "category-best"),
                RecommendationItem(itemId = 1002, score = 800.0, source = "category-best"),
            ),
            generatedAt = Instant.now(),
        )

        `when`("execute") {
            then("repository 의 결과를 그대로 반환한다") {
                val result = useCase.execute(1, 10, 20)
                result.items.size shouldBe 2
                result.items[0].itemId shouldBe 1001L
            }
        }
    }

    given("limit=0") {
        `when`("execute") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> { useCase.execute(1, 10, 0) }
            }
        }
    }

    given("limit=101 (MAX_LIMIT 초과)") {
        `when`("execute") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> { useCase.execute(1, 10, 101) }
            }
        }
    }

    given("cityId=0 (음수 또는 0)") {
        `when`("execute") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> { useCase.execute(0, 10, 20) }
            }
        }
    }
})
