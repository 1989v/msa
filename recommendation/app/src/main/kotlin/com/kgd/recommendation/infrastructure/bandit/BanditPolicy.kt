package com.kgd.recommendation.infrastructure.bandit

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * Phase 6 — funnel variant 후보 정의 + Thompson Sampler 위임.
 *
 * env `recommendation.bandit.enabled=true` 일 때만 활성. false 면 default funnel.
 *
 * 4 variants:
 * - control                   : Phase 1 CB
 * - retrieval-only            : Phase 3 Two-Tower only
 * - retrieval-and-rank        : Phase 4 W&D ranking
 * - retrieval-and-rank-dlrm   : Phase 5 DLRM ranking
 */
@Component
class BanditPolicy(
    private val sampler: ThompsonSampler,
    @Value("\${recommendation.bandit.enabled:false}") private val enabled: Boolean,
) {
    fun selectIfEnabled(): String? = if (enabled) sampler.select(VARIANTS) else null

    fun recordImpression(variant: String) {
        if (!enabled) return
        // 노출 시점에는 failure 로 기록 (clicked=false). 클릭 도착 시 update 가 success 로 보정.
        // 이 단순화는 instance-local + eventually consistent 모델에 적절.
        sampler.update(variant, clicked = false)
    }

    fun recordClick(variant: String) {
        if (!enabled) return
        sampler.update(variant, clicked = true)
        // failure 가 위에서 noise 로 누적되었을 수 있음 — 정밀한 경우 별도 카운터 분리 필요
    }

    fun snapshot(): List<ThompsonSampler.BanditStats> = sampler.snapshot().values.toList()

    companion object {
        val VARIANTS = listOf(
            "control",
            "retrieval-only",
            "retrieval-and-rank",
            "retrieval-and-rank-dlrm",
        )
    }
}
