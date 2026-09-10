package com.kgd.recommendation.infrastructure.bandit

import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.commons.math3.distribution.BetaDistribution
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Phase 6 — Thompson Sampling for funnel variant selection (ADR-0049).
 *
 * 학습 자료: study/docs/20-recommendation-modeling/08-season-trip-home-mab.md §6
 *
 * 각 variant 의 click-through rate 를 Beta(α, β) posterior 로 모델링.
 * 매 요청 시 모든 variant 에서 sample → argmax → 해당 variant 노출.
 * 노출/클릭 이벤트 시 update.
 *
 * Instance-local — k3d-lite 1 replica 환경에 적합. Multi-instance 는 Redis 분산 필요 (Phase 7+).
 */
@Component
class ThompsonSampler(
    @Value("\${recommendation.bandit.alpha-prior:1.0}") private val alphaPrior: Double,
    @Value("\${recommendation.bandit.beta-prior:10.0}") private val betaPrior: Double,
) {
    private val logger = KotlinLogging.logger {}

    private val successCounts = ConcurrentHashMap<String, AtomicLong>()
    private val failureCounts = ConcurrentHashMap<String, AtomicLong>()

    /**
     * 주어진 variants 중 Beta posterior 에서 sampling 후 최대값 선택.
     */
    fun select(variants: List<String>): String {
        if (variants.isEmpty()) throw IllegalArgumentException("variants must not be empty")

        var bestVariant = variants.first()
        var bestSample = -Double.MAX_VALUE
        variants.forEach { v ->
            val a = (successCounts.getOrDefault(v, AtomicLong(0)).get()).toDouble() + alphaPrior
            val b = (failureCounts.getOrDefault(v, AtomicLong(0)).get()).toDouble() + betaPrior
            val sample = BetaDistribution(a, b).sample()
            if (sample > bestSample) {
                bestSample = sample
                bestVariant = v
            }
        }
        return bestVariant
    }

    /** 노출 후 clicked=true/false 결과를 posterior 에 반영. */
    fun update(variant: String, clicked: Boolean) {
        if (clicked) {
            successCounts.computeIfAbsent(variant) { AtomicLong(0) }.incrementAndGet()
        } else {
            failureCounts.computeIfAbsent(variant) { AtomicLong(0) }.incrementAndGet()
        }
    }

    /** 메트릭/디버깅용 — 각 variant 의 posterior 상태 snapshot. */
    fun snapshot(): Map<String, BanditStats> {
        val variants = successCounts.keys + failureCounts.keys
        return variants.associateWith { v ->
            val a = successCounts[v]?.get() ?: 0L
            val b = failureCounts[v]?.get() ?: 0L
            BanditStats(
                variant = v,
                successes = a,
                failures = b,
                expectedCtr = (a + alphaPrior) / (a + b + alphaPrior + betaPrior),
            )
        }
    }

    data class BanditStats(
        val variant: String,
        val successes: Long,
        val failures: Long,
        val expectedCtr: Double,
    )
}
