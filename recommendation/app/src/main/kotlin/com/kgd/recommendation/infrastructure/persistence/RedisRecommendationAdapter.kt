package com.kgd.recommendation.infrastructure.persistence

import com.kgd.recommendation.port.RecommendationRepository
import com.kgd.recommendation.recommendation.Recommendation
import com.kgd.recommendation.recommendation.RecommendationContext
import com.kgd.recommendation.recommendation.RecommendationItem
import com.kgd.recommendation.recommendation.RecommendationType
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Instant

/**
 * Phase 1 — 사전 계산된 도시×카테고리 Top-N 을 Redis ZSET 에서 조회.
 *
 * Key: `reco:cb:{cityId}:{categoryId}`
 * Value: ZSET 의 member=itemId(String), score=ranking score
 * TTL: 25 hours (Argo daily sync 이후 안전 마진)
 *
 * 쓰기는 [com.kgd.recommendation.infrastructure.sync.CbScoreSync] 가 담당.
 */
@Repository
class RedisRecommendationAdapter(
    private val redis: StringRedisTemplate,
) : RecommendationRepository {

    override fun findCategoryBest(cityId: Long, categoryId: Long, limit: Int): Recommendation {
        require(limit > 0) { "limit must be > 0, got $limit" }

        val key = cbKey(cityId, categoryId)
        val tuples = redis.opsForZSet()
            .reverseRangeWithScores(key, 0, (limit - 1).toLong())
            ?: emptySet()

        val items = tuples.mapNotNull { tuple ->
            val itemId = tuple.value?.toLongOrNull() ?: return@mapNotNull null
            val score = tuple.score ?: 0.0
            RecommendationItem(itemId = itemId, score = score, source = "category-best")
        }

        return Recommendation(
            type = RecommendationType.CATEGORY_BEST,
            userId = null,
            context = RecommendationContext(cityId = cityId, categoryId = categoryId),
            items = items,
            generatedAt = Instant.now(),
        )
    }

    companion object {
        fun cbKey(cityId: Long, categoryId: Long): String = "reco:cb:$cityId:$categoryId"
    }
}
