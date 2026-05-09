package com.kgd.quant.application.discover

/**
 * RankingPort — ADR-0042 ranking 조회 추상화.
 *
 * 구현체:
 * - ClickHouseRankingAdapter (V008 VIEW 활용, 단일 쿼리, @Primary)
 * - FallbackRankingAdapter (자산 카탈로그 + OhlcvRepositoryPort N+1, ClickHouse JdbcTemplate 미가용 시)
 */
interface RankingPort {
    suspend fun rank(
        mode: RankingMode,
        marketFilter: String? = null,
        limit: Int = 20,
    ): List<MarketRanking>
}
