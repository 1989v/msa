package com.kgd.recommendation.infrastructure.bandit

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component

/**
 * Phase 6 / 6+ — funnel variant 후보 정의 + Thompson Sampler 위임.
 *
 * env:
 *   recommendation.bandit.enabled   = true/false (default false)
 *   recommendation.bandit.backend   = "memory" (default) | "redis"
 *
 * Backend:
 * - memory : ThompsonSampler (instance-local, k3d 단일 replica 적합)
 * - redis  : RedisThompsonSampler (multi-instance 공유 posterior, HINCRBY atomic)
 *
 * 4 variants:
 * - control                      Phase 1 CB
 * - retrieval-only               Phase 3 Two-Tower
 * - retrieval-and-rank           Phase 4 W&D
 * - retrieval-and-rank-dlrm      Phase 5 DLRM
 */
@Component
class BanditPolicy(
    private val memorySampler: ThompsonSampler,
    private val redisTemplate: StringRedisTemplate,
    @Value("\${recommendation.bandit.enabled:false}") private val enabled: Boolean,
    @Value("\${recommendation.bandit.backend:memory}") private val backend: String,
    @Value("\${recommendation.bandit.alpha-prior:1.0}") private val alphaPrior: Double,
    @Value("\${recommendation.bandit.beta-prior:10.0}") private val betaPrior: Double,
) {
    private val logger = KotlinLogging.logger {}
    private val redisSampler: RedisThompsonSampler by lazy {
        RedisThompsonSampler(redisTemplate, alphaPrior, betaPrior)
    }

    init {
        logger.info { "BanditPolicy enabled=$enabled backend=$backend" }
    }

    fun selectIfEnabled(): String? {
        if (!enabled) return null
        return when (backend) {
            "redis" -> redisSampler.select(VARIANTS)
            else -> memorySampler.select(VARIANTS)
        }
    }

    fun recordImpression(variant: String) {
        if (!enabled) return
        when (backend) {
            "redis" -> redisSampler.update(variant, clicked = false)
            else -> memorySampler.update(variant, clicked = false)
        }
    }

    fun recordClick(variant: String) {
        if (!enabled) return
        when (backend) {
            "redis" -> redisSampler.update(variant, clicked = true)
            else -> memorySampler.update(variant, clicked = true)
        }
    }

    fun snapshot(): List<ThompsonSampler.BanditStats> {
        val data = when (backend) {
            "redis" -> redisSampler.snapshot()
            else -> memorySampler.snapshot()
        }
        return data.values.toList().sortedByDescending { it.successes }
    }

    fun reset() {
        when (backend) {
            "redis" -> redisSampler.reset()
            // memory 는 process restart 로 reset
        }
    }

    companion object {
        val VARIANTS = listOf(
            "control",
            "retrieval-only",
            "retrieval-and-rank",
            "retrieval-and-rank-dlrm",
        )
    }
}
