package com.kgd.analytics.infrastructure.bandit

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository

/**
 * Bandit state writer. ADR-0050 Phase 3 — 다중 scope 일반화 후 key 포맷:
 *
 *   KEY:    bandit:state:{scope}:{productId}
 *           ex: bandit:state:category:elec:p1  ·  bandit:state:brand:samsung:p1
 *   FIELDS: clicks (long), impressions (long), lastTs (epoch ms)
 *
 * HINCRBY 가 atomic 이라 별도 락 불필요. (searchId, scope, productId, kind) 의 중복 방어는
 * Redis SET `bandit:seen:{kind}:{searchId}:{productId}` (짧은 TTL) 로 best-effort.
 */
@Repository
class BanditStateRedisWriter(
    private val redis: StringRedisTemplate
) {
    private val log = KotlinLogging.logger {}

    fun incrementImpression(scope: String, productId: String, ts: Long) {
        val key = redisKey(scope, productId)
        runCatching {
            redis.opsForHash<String, String>().increment(key, FIELD_IMPRESSIONS, 1L)
            redis.opsForHash<String, String>().put(key, FIELD_LAST_TS, ts.toString())
        }.onFailure { log.warn { "Bandit impression write failed key=$key: ${it.message}" } }
    }

    fun incrementClick(scope: String, productId: String, ts: Long) {
        val key = redisKey(scope, productId)
        runCatching {
            redis.opsForHash<String, String>().increment(key, FIELD_CLICKS, 1L)
            redis.opsForHash<String, String>().put(key, FIELD_LAST_TS, ts.toString())
        }.onFailure { log.warn { "Bandit click write failed key=$key: ${it.message}" } }
    }

    /**
     * 같은 (searchId, productId) 가 짧은 시간(5분) 안에 다시 들어오면 중복으로 본다.
     * @return true 면 첫 발생 (이번에 카운트해야 함)
     */
    fun markSeen(searchId: String, productId: String, kind: String): Boolean {
        val key = "bandit:seen:$kind:$searchId:$productId"
        val set = runCatching {
            redis.opsForValue().setIfAbsent(key, "1", DEDUP_TTL_SECONDS, java.util.concurrent.TimeUnit.SECONDS)
        }.getOrNull()
        return set ?: true
    }

    companion object {
        private const val FIELD_CLICKS = "clicks"
        private const val FIELD_IMPRESSIONS = "impressions"
        private const val FIELD_LAST_TS = "lastTs"
        private const val DEDUP_TTL_SECONDS = 300L

        fun redisKey(scope: String, productId: String): String =
            "bandit:state:$scope:$productId"
    }
}
