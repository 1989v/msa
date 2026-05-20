package com.kgd.search.bandit

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * ADR-0050 Phase 3 — seller diversity rerank 외부 설정.
 *
 * 알고리즘: top-K 내에서 동일 seller (현재는 categoryId 를 proxy 로 사용 — brand 필드 도입 후 자연 교체)
 * 가 [maxPerSeller] 회 초과해 등장하면 뒤로 밀어내고 다른 seller 를 끌어올리는 round-robin.
 *
 * 기본은 비활성. 활성화는 점진적 ramp 권장 (ADR-0050 §Phase 3 참조).
 */
@ConfigurationProperties(prefix = "search.diversity")
data class DiversityProperties(
    val enabled: Boolean = false,
    val maxPerSeller: Int = 3,
    val topK: Int = 20,
    /**
     * seller key 추출 strategy. 현재는 `category` 만 지원 (proxy). brand 필드 도입 시 `brand` 추가.
     */
    val sellerKey: String = SELLER_KEY_CATEGORY
) {
    init {
        require(maxPerSeller > 0) { "maxPerSeller must be > 0" }
        require(topK > 0) { "topK must be > 0" }
    }

    companion object {
        const val SELLER_KEY_CATEGORY = "category"
        const val SELLER_KEY_BRAND = "brand"
    }
}
