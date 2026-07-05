package com.kgd.search.domain.product.port

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.model.ScoredProductDocument
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ProductSearchPort {
    fun search(keyword: String, pageable: Pageable): Page<ProductDocument>

    /**
     * ES `_score` 를 동봉해 반환. application 레이어의 reranker (e.g. ThompsonReranker)
     * 가 esScore 를 hybrid 계산에 사용한다. 기본 구현은 score 0.0 으로 wrap — 어댑터가 override.
     *
     * [rankingVariant] 는 온라인 A/B (experiment 서비스 할당) 의 variant 키.
     * 도메인은 키만 통과시키고, 키 → ranking 설정 매핑은 어댑터가 담당한다.
     * null 또는 미정의 키 = 기본 ranking.
     *
     * [filters] 는 점수와 무관한 hard filter (ADR-0059 — 칼로리 범위 등).
     */
    fun searchScored(
        keyword: String,
        pageable: Pageable,
        rankingVariant: String? = null,
        filters: Filters = Filters.NONE,
    ): Page<ScoredProductDocument> =
        search(keyword, pageable).map { ScoredProductDocument(it, 0.0) }

    /** 상품명 prefix 자동완성 — ACTIVE 상품만, 인기도 부스트는 어댑터 구현에 위임. */
    fun suggest(prefix: String, size: Int): List<ProductDocument>

    /** 검색 hard filter — 영양(에너지 kcal/100g) 범위. 값이 모두 null 이면 미적용. */
    data class Filters(
        val minKcal: Double? = null,
        val maxKcal: Double? = null,
    ) {
        fun isEmpty(): Boolean = minKcal == null && maxKcal == null

        companion object {
            val NONE = Filters()
        }
    }
}
