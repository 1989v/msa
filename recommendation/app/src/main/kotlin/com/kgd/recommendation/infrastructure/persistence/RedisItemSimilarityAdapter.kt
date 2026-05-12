package com.kgd.recommendation.infrastructure.persistence

import com.kgd.recommendation.port.ItemSimilarityPort
import com.kgd.recommendation.recommendation.RecommendationItem
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository

/**
 * Phase 2 — 사전 계산된 item-item similarity 를 Redis ZSET 에서 조회.
 *
 * Key: `reco:similar:{itemId}`
 * Value: ZSET (member=similarItemId, score=PPMI similarity)
 *
 * 쓰기는 [com.kgd.recommendation.infrastructure.sync.ItemSimilaritySync] 가 담당.
 */
@Repository
class RedisItemSimilarityAdapter(
    private val redis: StringRedisTemplate,
) : ItemSimilarityPort {

    override fun findSimilar(itemId: Long, limit: Int): List<RecommendationItem> {
        require(limit > 0) { "limit must be > 0, got $limit" }

        val key = similarKey(itemId)
        val tuples = redis.opsForZSet()
            .reverseRangeWithScores(key, 0, (limit - 1).toLong())
            ?: emptySet()

        return tuples.mapNotNull { tuple ->
            val targetId = tuple.value?.toLongOrNull() ?: return@mapNotNull null
            RecommendationItem(
                itemId = targetId,
                score = tuple.score ?: 0.0,
                source = "item-item-cf-ppmi",
            )
        }
    }

    companion object {
        fun similarKey(itemId: Long): String = "reco:similar:$itemId"
    }
}
