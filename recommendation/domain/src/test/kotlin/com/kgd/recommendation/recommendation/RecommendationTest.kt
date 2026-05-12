package com.kgd.recommendation.recommendation

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class RecommendationTest : BehaviorSpec({

    fun item(id: Long, score: Double) = RecommendationItem(itemId = id, score = score, source = "test")
    fun rec(items: List<RecommendationItem>) = Recommendation(
        type = RecommendationType.CATEGORY_BEST,
        userId = null,
        context = RecommendationContext(cityId = 1, categoryId = 10),
        items = items,
        generatedAt = Instant.now(),
    )

    given("topK 호출 시") {
        `when`("items 가 score 정렬되지 않은 상태") {
            then("score 내림차순 + 상위 K 만 반환된다") {
                val original = rec(listOf(item(1, 50.0), item(2, 100.0), item(3, 30.0), item(4, 80.0)))
                val top2 = original.topK(2)
                top2.items.map { it.itemId } shouldBe listOf(2L, 4L)
            }
        }
        `when`("k 가 items 수보다 클 때") {
            then("모든 item 이 그대로 정렬되어 반환된다") {
                val original = rec(listOf(item(1, 10.0), item(2, 20.0)))
                val top10 = original.topK(10)
                top10.items.map { it.itemId } shouldBe listOf(2L, 1L)
            }
        }
        `when`("k 가 음수") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> { rec(emptyList()).topK(-1) }
            }
        }
    }

    given("isInsufficient 호출 시") {
        `when`("items.size < requiredLimit") {
            then("true 반환 (fallback 트리거)") {
                rec(listOf(item(1, 10.0), item(2, 20.0))).isInsufficient(requiredLimit = 5) shouldBe true
            }
        }
        `when`("items.size >= requiredLimit") {
            then("false 반환") {
                rec(listOf(item(1, 10.0), item(2, 20.0), item(3, 30.0))).isInsufficient(requiredLimit = 2) shouldBe false
            }
        }
    }
})
