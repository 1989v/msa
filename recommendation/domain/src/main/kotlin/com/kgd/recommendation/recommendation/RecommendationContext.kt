package com.kgd.recommendation.recommendation

/**
 * 추천 호출 컨텍스트. type 별로 의미 있는 필드가 다름.
 *
 * - CATEGORY_BEST  : cityId + categoryId (사용자 무관)
 * - SIMILAR_ITEMS  : sourceItemId (현재 보는 아이템)
 * - PERSONALIZED   : userId (RecommendationContext 외부에서 별도 전달)
 */
data class RecommendationContext(
    val cityId: Long? = null,
    val categoryId: Long? = null,
    val sourceItemId: Long? = null,
)
