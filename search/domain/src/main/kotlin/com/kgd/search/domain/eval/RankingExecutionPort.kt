package com.kgd.search.domain.eval

/**
 * 평가 시 같은 query 로 ES 검색을 실행해 top-K productId 목록을 반환.
 * 구현체는 search:batch 에서 ElasticsearchOperations 직접 사용 (baseline variant).
 *
 * Phase 4 UI 에서 variant 별 ranking properties 를 주입하는 확장은 후속 작업.
 */
interface RankingExecutionPort {
    fun searchTopK(query: String, k: Int): List<String>
}
