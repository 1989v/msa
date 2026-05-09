package com.kgd.quant.application.discover

/**
 * RankingPort — ADR-0042 ranking 조회 추상화.
 *
 * 구현체:
 * - ClickHouseRankingAdapter (V008 VIEW 활용, 단일 쿼리, @Primary)
 * - FallbackRankingAdapter (자산 카탈로그 + OhlcvRepositoryPort N+1, ClickHouse JdbcTemplate 미가용 시)
 */
interface RankingPort {
    /**
     * @param krwPerUsd KR 자산의 turnover 를 USD 환산하여 비교 정렬할 때 사용.
     *                   null/0 이면 raw 단위 그대로 비교 (기본 동작 유지).
     */
    suspend fun rank(
        mode: RankingMode,
        marketFilter: String? = null,
        limit: Int = 20,
        krwPerUsd: Double? = null,
    ): List<MarketRanking>
}
