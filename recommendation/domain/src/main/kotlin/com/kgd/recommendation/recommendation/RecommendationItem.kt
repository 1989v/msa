package com.kgd.recommendation.recommendation

/**
 * 추천 결과 한 row.
 *
 * @property itemId 추천 대상 식별자
 * @property score  ranking score (Phase 별 의미 다름 — CB 는 행동 가중합 × Wilson LCB,
 *                  Similar 는 PPMI, Personalized 는 cosine)
 * @property source 어느 알고리즘이 만들었는지 — 디버깅 / A/B 분석용
 */
data class RecommendationItem(
    val itemId: Long,
    val score: Double,
    val source: String,
)
