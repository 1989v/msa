package com.kgd.analytics.infrastructure.cache

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.analytics.domain.model.KeywordScore
import com.kgd.analytics.domain.model.ProductScore
import com.kgd.analytics.domain.model.ScoreStats
import com.kgd.analytics.domain.port.ScoreCachePort
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

@Component
class ScoreCacheAdapter(
    private val redis: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    @Value("\${analytics.score.product-cache-ttl:7200}") private val productTtl: Long,
    @Value("\${analytics.score.keyword-cache-ttl:7200}") private val keywordTtl: Long,
    @Value("\${analytics.score.stats-cache-ttl:3600}") private val statsTtl: Long
) : ScoreCachePort {

    override fun cacheProductScore(score: ProductScore) {
        redis.opsForValue().set(
            "score:product:${score.productId}",
            objectMapper.writeValueAsString(score),
            Duration.ofSeconds(productTtl)
        )
    }

    override fun getProductScore(productId: Long): ProductScore? =
        redis.opsForValue().get("score:product:$productId")
            ?.let { objectMapper.readValue(it, ProductScore::class.java) }

    override fun getProductScores(productIds: List<Long>): List<ProductScore> {
        if (productIds.isEmpty()) return emptyList()
        val keys = productIds.map { "score:product:$it" }
        return redis.opsForValue().multiGet(keys)
            ?.filterNotNull()
            ?.map { objectMapper.readValue(it, ProductScore::class.java) }
            ?: emptyList()
    }

    override fun cacheKeywordScore(score: KeywordScore) {
        redis.opsForValue().set(
            "score:keyword:${score.keyword}",
            objectMapper.writeValueAsString(score),
            Duration.ofSeconds(keywordTtl)
        )
    }

    override fun getKeywordScore(keyword: String): KeywordScore? =
        redis.opsForValue().get("score:keyword:$keyword")
            ?.let { objectMapper.readValue(it, KeywordScore::class.java) }

    override fun updateProductStats(stats: ScoreStats) {
        redis.opsForValue().set(
            "score:product:stats",
            objectMapper.writeValueAsString(stats),
            Duration.ofSeconds(statsTtl)
        )
    }

    override fun getProductStats(): ScoreStats? =
        redis.opsForValue().get("score:product:stats")
            ?.let { objectMapper.readValue(it, ScoreStats::class.java) }

    override fun updateKeywordStats(stats: ScoreStats) {
        redis.opsForValue().set(
            "score:keyword:stats",
            objectMapper.writeValueAsString(stats),
            Duration.ofSeconds(statsTtl)
        )
    }

    override fun getKeywordStats(): ScoreStats? =
        redis.opsForValue().get("score:keyword:stats")
            ?.let { objectMapper.readValue(it, ScoreStats::class.java) }
}
