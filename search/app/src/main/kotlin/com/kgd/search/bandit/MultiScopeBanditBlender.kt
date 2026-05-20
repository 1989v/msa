package com.kgd.search.bandit

import com.kgd.search.domain.bandit.model.BanditKey
import com.kgd.search.domain.bandit.model.BanditState
import com.kgd.search.domain.bandit.port.BanditStatePort
import com.kgd.search.domain.product.model.ProductDocument
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import kotlin.math.exp

/**
 * ADR-0050 Phase 3 — 다중 scope MAB 의 weighted-average blend.
 *
 * 각 scope (category / brand / …) 에서 Thompson 샘플을 뽑고, [ScopeConfig.weight] 로 평균.
 * scope 가 한 개이면 기존 ThompsonReranker 의 단일 scope sampleFor 와 정확히 동일하게 동작.
 *
 * scope 별 bucket id 는 product 도메인 모델에서 추출:
 * - category → [ProductDocument.categoryId]
 * - brand   → 현재 ProductDocument 에 brand 가 없으면 `null` 처리 → `_default_` scope id 사용
 *             (Phase 3 별도 task P3-T0 에서 brand 필드 도입 후 자연 활성화)
 */
@Component
class MultiScopeBanditBlender(
    private val properties: BanditProperties,
    private val banditStatePort: BanditStatePort,
    private val clock: Clock = Clock.systemUTC()
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * 각 product 에 대해 blended Thompson sample 을 반환. 0..1 범위.
     */
    fun blend(docs: List<ProductDocument>): Map<String, Double> {
        if (docs.isEmpty()) return emptyMap()
        val scopes = properties.effectiveScopes()
        if (scopes.isEmpty()) {
            // 안전 fallback — uniform prior
            return docs.associate { it.id to 0.5 }
        }

        // 각 scope 에서 fetch 할 key list 준비 (null/blank id 는 default scope 로 fallback)
        val perScopeKeys: Map<ScopeConfig, List<BanditKey>> = scopes.associateWith { cfg ->
            docs.map { doc -> keyFor(cfg, doc) }
        }

        // scope 별 batch fetch (각각 별도 호출 — Redis MGET 균등 부하)
        val perScopeStates: Map<ScopeConfig, Map<BanditKey, BanditState>> = perScopeKeys.mapValues { (cfg, keys) ->
            runCatching { banditStatePort.fetchBatch(keys) }
                .onFailure { log.warn("scope={} fetchBatch failed, prior-only: {}", cfg.name, it.message) }
                .getOrDefault(emptyMap())
        }

        val now = Instant.now(clock)
        val totalWeight = scopes.sumOf { it.weight }

        return docs.associate { doc ->
            val score = scopes.sumOf { cfg ->
                val key = keyFor(cfg, doc)
                val state = perScopeStates[cfg]?.get(key)
                cfg.weight * sampleFor(cfg, key, state, now)
            } / totalWeight
            doc.id to score
        }
    }

    /** ThompsonReranker 가 단건 샘플링 재사용을 위해 노출 (테스트/디버그 용도). */
    fun sampleFor(cfg: ScopeConfig, key: BanditKey, state: BanditState?, now: Instant): Double {
        val scopeId = extractScopeId(key.scope, cfg.name)
        val (priorA, priorB) = cfg.priorFor(scopeId)

        if (state == null || state.impressions < properties.impressionThreshold) {
            return BetaSampler.sample(priorA, priorB)
        }

        val decay = if (properties.decayLambdaPerDay > 0.0) {
            exp(-properties.decayLambdaPerDay * state.ageDays(now))
        } else 1.0
        val effClicks = state.clicks * decay
        val effImpressions = state.impressions * decay

        val alpha = effClicks + priorA
        val beta = (effImpressions - effClicks).coerceAtLeast(0.0) + priorB
        return BetaSampler.sample(alpha, beta)
    }

    private fun keyFor(cfg: ScopeConfig, doc: ProductDocument): BanditKey =
        when (cfg.name) {
            BanditKey.SCOPE_CATEGORY -> BanditKey.category(doc.categoryId, doc.id)
            BanditKey.SCOPE_BRAND -> BanditKey.brand(extractBrand(doc), doc.id)
            else -> BanditKey.custom(cfg.name, scopeIdFromDoc(cfg.name, doc), doc.id)
        }

    /** ProductDocument.brand 가 ADR-0050 Phase 3 (T1) 에서 도입됨. brand-scope MAB 자연 활성화. */
    private fun extractBrand(doc: ProductDocument): String? = doc.brand

    /** custom scope 의 id 추출. 현재 hook 만 제공, 실제 추출 로직은 도메인 확장 시 구현. */
    private fun scopeIdFromDoc(scopeName: String, doc: ProductDocument): String? = null

    /** "category:elec" → "elec", "_default_" → "_default_" 로 파싱. */
    private fun extractScopeId(qualifiedScope: String, scopeType: String): String {
        val prefix = "$scopeType:"
        return if (qualifiedScope.startsWith(prefix)) qualifiedScope.removePrefix(prefix) else qualifiedScope
    }
}
