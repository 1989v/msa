package com.kgd.recommendation.port

import com.kgd.recommendation.recommendation.Recommendation

/**
 * 룰 기반 추천 (Phase 1) 의 출력 port.
 *
 * Phase 1 구현체는 사전 계산된 Top-N 을 Redis ZSET 에서 lookup 한다 — Argo CronWorkflow 가
 * ClickHouse `analytics.recommendation_score_daily` 에서 행동 가중합 + Wilson LCB 로
 * 산출 후 Redis 에 적재한다.
 */
interface RecommendationRepository {
    /**
     * 도시 × 카테고리 단위 인기 추천 Top-N 조회.
     * 결과가 부족하거나 캐시 미스 시 빈 list 를 가진 [Recommendation] 반환.
     */
    fun findCategoryBest(cityId: Long, categoryId: Long, limit: Int): Recommendation
}
