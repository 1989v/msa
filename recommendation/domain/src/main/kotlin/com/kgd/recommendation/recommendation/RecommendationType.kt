package com.kgd.recommendation.recommendation

/**
 * 추천 종류 — ADR-0044 의 Phase 별 도입 단계에 1:1 대응.
 */
enum class RecommendationType {
    /** Phase 1 — 룰 기반 도시×카테고리 인기 (행동 가중합 + Wilson LCB). */
    CATEGORY_BEST,

    /** Phase 2 — Item-Item CF (공출현 행렬 + PPMI). */
    SIMILAR_ITEMS,

    /** Phase 3 — Two-Tower deep retrieval (user embedding + ANN). */
    PERSONALIZED,
}
