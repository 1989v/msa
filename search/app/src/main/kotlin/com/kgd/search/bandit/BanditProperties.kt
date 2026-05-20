package com.kgd.search.bandit

import com.kgd.search.domain.bandit.model.BanditKey
import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * ADR-0043 + ADR-0050 Phase 3 — Thompson Sampling MAB 의 외부화 설정.
 *
 * Phase 3 변경:
 * - `scopes` 외부화 — 다중 scope 의 weighted average blend 지원.
 *   default 는 category 단일 (기존 동작과 동일).
 * - 기존 `categoryPriors` / `priorAlpha` / `priorBeta` 는 호환을 위해 유지하되,
 *   `scopes` 가 명시되면 그쪽 prior 가 우선한다.
 */
@ConfigurationProperties(prefix = "search.bandit")
data class BanditProperties(
    val enabled: Boolean = true,
    val topN: Int = 100,
    val priorAlpha: Double = 1.0,
    val priorBeta: Double = 9.0,
    val decayLambdaPerDay: Double = 0.02,
    val hybridWeight: Double = 0.8,
    val impressionThreshold: Long = 50,
    val sessionCacheSeconds: Long = 60,
    /** legacy: 단일 scope 시절의 카테고리별 prior. `scopes[*].overrides` 가 동등 기능. */
    val categoryPriors: Map<String, String> = emptyMap(),
    /** ADR-0050 Phase 3 — 다중 scope blend 구성. 비어있으면 category 단일 scope 로 동작. */
    val scopes: List<ScopeConfig> = emptyList()
) {
    init {
        require(topN > 0) { "topN must be > 0" }
        require(priorAlpha > 0.0 && priorBeta > 0.0) { "priors must be > 0" }
        require(decayLambdaPerDay >= 0.0) { "decay lambda must be >= 0" }
        require(hybridWeight in 0.0..1.0) { "hybridWeight must be in [0,1]" }
        require(impressionThreshold >= 0) { "impressionThreshold must be >= 0" }
        require(sessionCacheSeconds >= 0) { "sessionCacheSeconds must be >= 0" }
        scopes.forEach { require(it.weight > 0.0) { "scope weight must be > 0: ${it.name}" } }
    }

    /**
     * 활성화된 scope 설정. `scopes` 가 비어있으면 default category scope 를 합성.
     */
    fun effectiveScopes(): List<ScopeConfig> = if (scopes.isEmpty()) {
        listOf(
            ScopeConfig(
                name = BanditKey.SCOPE_CATEGORY,
                weight = 1.0,
                priorAlpha = priorAlpha,
                priorBeta = priorBeta,
                overrides = categoryPriors
            )
        )
    } else scopes.filter { it.enabled }

    @Deprecated("Use ScopeConfig.priorFor()", ReplaceWith("effectiveScopes().first().priorFor(scopeId)"))
    fun priorFor(categoryId: String): Pair<Double, Double> {
        val raw = categoryPriors[categoryId] ?: return priorAlpha to priorBeta
        val parts = raw.split(",").map { it.trim() }
        if (parts.size != 2) return priorAlpha to priorBeta
        val a = parts[0].toDoubleOrNull() ?: return priorAlpha to priorBeta
        val b = parts[1].toDoubleOrNull() ?: return priorAlpha to priorBeta
        return a to b
    }
}

/**
 * 한 scope (category / brand / 기타) 의 MAB 운영 파라미터.
 * - [weight]: blend 시 다른 scope 대비 가중치
 * - [priorAlpha]/[priorBeta]: 글로벌 prior
 * - [overrides]: "scopeId" → "alpha,beta" — 특정 bucket prior 오버라이드
 */
data class ScopeConfig(
    val name: String,
    val enabled: Boolean = true,
    val weight: Double = 1.0,
    val priorAlpha: Double = 1.0,
    val priorBeta: Double = 9.0,
    val overrides: Map<String, String> = emptyMap()
) {
    fun priorFor(scopeId: String): Pair<Double, Double> {
        val raw = overrides[scopeId] ?: return priorAlpha to priorBeta
        val parts = raw.split(",").map { it.trim() }
        if (parts.size != 2) return priorAlpha to priorBeta
        val a = parts[0].toDoubleOrNull() ?: return priorAlpha to priorBeta
        val b = parts[1].toDoubleOrNull() ?: return priorAlpha to priorBeta
        return a to b
    }
}
