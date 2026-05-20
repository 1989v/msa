package com.kgd.search.bandit

import com.kgd.search.domain.product.model.ProductDocument
import org.springframework.stereotype.Component

/**
 * ADR-0050 Phase 3 — top-K 내 seller (현재 categoryId proxy) 다양성 보강.
 *
 * 알고리즘 (round-robin 변형):
 *  1. 입력 정렬 유지하면서 한 번에 1 개씩 출력 큐에 push
 *  2. 같은 seller key 가 이미 K 내에서 `maxPerSeller` 회 등장했으면 뒤로 미루기
 *  3. K 밖은 그대로 보존
 *
 * 효과: 1개 seller 가 top-K 를 독점하는 케이스에서 long-tail seller 가 노출 기회 획득.
 */
@Component
class SellerDiversityReranker(
    private val properties: DiversityProperties
) {

    fun rerank(scored: List<Pair<ProductDocument, Double>>): List<Pair<ProductDocument, Double>> {
        if (!properties.enabled || scored.isEmpty()) return scored
        val topK = scored.take(properties.topK)
        val rest = scored.drop(properties.topK)

        val perSellerCount = mutableMapOf<String, Int>()
        val accepted = mutableListOf<Pair<ProductDocument, Double>>()
        val deferred = mutableListOf<Pair<ProductDocument, Double>>()

        for (pair in topK) {
            val seller = sellerKeyOf(pair.first)
            val cnt = perSellerCount.getOrDefault(seller, 0)
            if (cnt < properties.maxPerSeller) {
                accepted += pair
                perSellerCount[seller] = cnt + 1
            } else {
                deferred += pair
            }
        }

        // deferred 가 있어도 동일 K 슬롯에 들어가야 하므로 — 단순히 accepted + deferred + rest
        // accepted 의 cap 초과로 빠진 deferred 는 K 밖 영역의 앞으로 밀려난다.
        return accepted + deferred + rest
    }

    private fun sellerKeyOf(doc: ProductDocument): String =
        when (properties.sellerKey) {
            DiversityProperties.SELLER_KEY_CATEGORY -> doc.categoryId ?: SELLER_KEY_DEFAULT
            DiversityProperties.SELLER_KEY_BRAND -> doc.brand ?: SELLER_KEY_DEFAULT
            else -> SELLER_KEY_DEFAULT
        }

    companion object {
        private const val SELLER_KEY_DEFAULT = "_default_"
    }
}
