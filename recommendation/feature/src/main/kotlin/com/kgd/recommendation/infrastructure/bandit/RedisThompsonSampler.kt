package com.kgd.recommendation.infrastructure.bandit

import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.commons.math3.distribution.BetaDistribution
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate

/**
 * Phase 6+ — Multi-instance Thompson Sampler (Redis-backed posterior).
 *
 * In-memory sampler (ThompsonSampler) 의 한계인 instance-local posterior 를
 * Redis hash 로 공유. Multi-replica recommendation 에서 일관된 학습.
 *
 * Key 구조:
 *   reco:bandit:success — HASH { variant → count }
 *   reco:bandit:failure — HASH { variant → count }
 *
 * Race 방지: Redis HINCRBY 는 atomic. Read-modify-write 패턴 안 씀.
 *
 * `recommendation.bandit.backend=redis` 일 때 활성화. 미설정 시 in-memory 사용.
 */
class RedisThompsonSampler(
    private val redis: StringRedisTemplate,
    private val alphaPrior: Double,
    private val betaPrior: Double,
) {
    private val logger = KotlinLogging.logger {}

    fun select(variants: List<String>): String {
        require(variants.isNotEmpty()) { "variants must not be empty" }

        val successHash = redis.opsForHash<String, String>().entries(KEY_SUCCESS)
        val failureHash = redis.opsForHash<String, String>().entries(KEY_FAILURE)

        var bestVariant = variants.first()
        var bestSample = -Double.MAX_VALUE
        for (v in variants) {
            val a = (successHash[v]?.toLongOrNull() ?: 0L).toDouble() + alphaPrior
            val b = (failureHash[v]?.toLongOrNull() ?: 0L).toDouble() + betaPrior
            val sample = BetaDistribution(a, b).sample()
            if (sample > bestSample) {
                bestSample = sample
                bestVariant = v
            }
        }
        return bestVariant
    }

    fun update(variant: String, clicked: Boolean) {
        val key = if (clicked) KEY_SUCCESS else KEY_FAILURE
        try {
            redis.opsForHash<String, String>().increment(key, variant, 1L)
        } catch (e: Exception) {
            logger.warn { "Redis HINCRBY 실패 (key=$key variant=$variant): ${e.message}" }
        }
    }

    fun snapshot(): Map<String, ThompsonSampler.BanditStats> {
        val s = redis.opsForHash<String, String>().entries(KEY_SUCCESS)
        val f = redis.opsForHash<String, String>().entries(KEY_FAILURE)
        val variants = s.keys + f.keys
        return variants.associateWith { v ->
            val a = s[v]?.toLongOrNull() ?: 0L
            val b = f[v]?.toLongOrNull() ?: 0L
            ThompsonSampler.BanditStats(
                variant = v,
                successes = a,
                failures = b,
                expectedCtr = (a + alphaPrior) / (a + b + alphaPrior + betaPrior),
            )
        }
    }

    fun reset() {
        redis.delete(listOf(KEY_SUCCESS, KEY_FAILURE))
    }

    companion object {
        const val KEY_SUCCESS = "reco:bandit:success"
        const val KEY_FAILURE = "reco:bandit:failure"
    }
}
