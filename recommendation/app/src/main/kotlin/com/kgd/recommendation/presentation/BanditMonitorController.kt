package com.kgd.recommendation.presentation

import com.kgd.common.response.ApiResponse
import com.kgd.recommendation.infrastructure.bandit.BanditPolicy
import com.kgd.recommendation.infrastructure.bandit.ThompsonSampler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * Phase 6 — Thompson Sampler 모니터링 + 수동 reward update 엔드포인트.
 *
 * /internal prefix — gateway 비노출, K8s NetworkPolicy 로 cluster-internal 만.
 */
@RestController
@RequestMapping("/internal/bandit")
class BanditMonitorController(
    private val banditPolicy: BanditPolicy,
) {
    @GetMapping("/stats")
    fun stats(): ApiResponse<List<ThompsonSampler.BanditStats>> =
        ApiResponse.success(banditPolicy.snapshot())

    /** 운영자 수동 reward update (테스트/디버깅). 정상 흐름은 Kafka click consumer. */
    @PostMapping("/click")
    fun recordClick(@RequestParam variant: String): ApiResponse<Map<String, Any>> {
        banditPolicy.recordClick(variant)
        return ApiResponse.success(mapOf("variant" to variant, "recorded" to true))
    }

    /** 운영자 수동 reset (Redis backend 만 — multi-instance posterior 초기화). */
    @PostMapping("/reset")
    fun reset(): ApiResponse<Map<String, Boolean>> {
        banditPolicy.reset()
        return ApiResponse.success(mapOf("reset" to true))
    }
}
