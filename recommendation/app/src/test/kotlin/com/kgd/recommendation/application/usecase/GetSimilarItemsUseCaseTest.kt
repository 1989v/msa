package com.kgd.recommendation.application.usecase

import com.kgd.recommendation.port.ItemMetadata
import com.kgd.recommendation.port.ItemMetadataPort
import com.kgd.recommendation.port.ItemSimilarityPort
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
import io.mockk.verify
import java.time.Instant

class GetSimilarItemsUseCaseTest : BehaviorSpec({

    fun cfItem(id: Long, score: Double) = RecommendationItem(id, score, "item-item-cf-ppmi")
    fun cbItem(id: Long, score: Double) = RecommendationItem(id, score, "category-best")

    given("similar items 가 limit 의 50% 이상 (충분)") {
        val similarity = mockk<ItemSimilarityPort>()
        val metadata = mockk<ItemMetadataPort>()
        val repo = mockk<RecommendationRepository>()
        val useCase = GetSimilarItemsUseCase(similarity, metadata, repo)

        every { similarity.findSimilar(1001, 10) } returns (1..6).map { cfItem(2000L + it, 1.0 - it * 0.1) }

        `when`("execute(itemId=1001, limit=10)") {
            val result = useCase.execute(1001, 10)
            then("CF 결과만 반환, metadata/CB 호출 안 함") {
                result.items.size shouldBe 6
                result.items.all { it.source == "item-item-cf-ppmi" } shouldBe true
                verify(exactly = 0) { metadata.getCityAndCategory(any()) }
                verify(exactly = 0) { repo.findCategoryBest(any(), any(), any()) }
            }
        }
    }

    given("similar items 가 부족 (sparse), metadata 있음") {
        val similarity = mockk<ItemSimilarityPort>()
        val metadata = mockk<ItemMetadataPort>()
        val repo = mockk<RecommendationRepository>()
        val useCase = GetSimilarItemsUseCase(similarity, metadata, repo)

        every { similarity.findSimilar(1002, 10) } returns (1..3).map { cfItem(3000L + it, 0.5) }
        every { metadata.getCityAndCategory(1002) } returns ItemMetadata(1002, cityId = 1, categoryId = 10)
        every { repo.findCategoryBest(1, 10, 10) } returns Recommendation(
            type = RecommendationType.CATEGORY_BEST,
            userId = null,
            context = RecommendationContext(cityId = 1, categoryId = 10),
            items = (1..10).map { cbItem(4000L + it, 100.0 - it) },
            generatedAt = Instant.now(),
        )

        `when`("execute(itemId=1002, limit=10)") {
            val result = useCase.execute(1002, 10)
            then("CF 3개 + CB 7개 = 10개, source 가 섞여있다") {
                result.items.size shouldBe 10
                result.items.take(3).all { it.source == "item-item-cf-ppmi" } shouldBe true
                result.items.drop(3).all { it.source == "category-best" } shouldBe true
                result.context.cityId shouldBe 1L
                result.context.categoryId shouldBe 10L
                result.context.sourceItemId shouldBe 1002L
            }
        }
    }

    given("similar items 부족 + CB 결과에 source itemId 자체가 포함") {
        val similarity = mockk<ItemSimilarityPort>()
        val metadata = mockk<ItemMetadataPort>()
        val repo = mockk<RecommendationRepository>()
        val useCase = GetSimilarItemsUseCase(similarity, metadata, repo)

        every { similarity.findSimilar(5005, 10) } returns listOf(cfItem(5006, 0.5))
        every { metadata.getCityAndCategory(5005) } returns ItemMetadata(5005, 1, 1)
        // CB 결과에 itemId=5005 (source) 가 있음 — dedupe 되어야 한다
        every { repo.findCategoryBest(1, 1, 10) } returns Recommendation(
            type = RecommendationType.CATEGORY_BEST,
            userId = null,
            context = RecommendationContext(cityId = 1, categoryId = 1),
            items = listOf(
                cbItem(5005, 99.0),  // source itemId 자체
                cbItem(5006, 95.0),  // 이미 CF 에서 본 itemId
                cbItem(5007, 90.0),
                cbItem(5008, 88.0),
                cbItem(5009, 85.0),
            ),
            generatedAt = Instant.now(),
        )

        `when`("execute") {
            val result = useCase.execute(5005, 10)
            then("CF 1개 + CB (5005/5006 제외) 3개 = 4개") {
                result.items.size shouldBe 4
                result.items.map { it.itemId } shouldBe listOf(5006L, 5007L, 5008L, 5009L)
            }
        }
    }

    given("similar items 부족 + metadata 없음 (newer item)") {
        val similarity = mockk<ItemSimilarityPort>()
        val metadata = mockk<ItemMetadataPort>()
        val repo = mockk<RecommendationRepository>()
        val useCase = GetSimilarItemsUseCase(similarity, metadata, repo)

        every { similarity.findSimilar(9999, 10) } returns listOf(cfItem(8000, 0.7))
        every { metadata.getCityAndCategory(9999) } returns null

        `when`("execute") {
            val result = useCase.execute(9999, 10)
            then("CF 결과만 (CB fallback 불가)") {
                result.items.size shouldBe 1
                verify(exactly = 0) { repo.findCategoryBest(any(), any(), any()) }
            }
        }
    }

    given("invalid input") {
        val useCase = GetSimilarItemsUseCase(mockk(), mockk(), mockk())
        `when`("itemId=0") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> { useCase.execute(0, 10) }
            }
        }
        `when`("limit=0 또는 limit>100") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> { useCase.execute(1, 0) }
                shouldThrow<IllegalArgumentException> { useCase.execute(1, 101) }
            }
        }
    }
})
