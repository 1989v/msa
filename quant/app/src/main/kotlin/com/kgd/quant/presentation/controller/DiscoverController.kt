package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.discover.GlobalIndicesQuery
import com.kgd.quant.application.discover.MarketRanking
import com.kgd.quant.application.discover.RankingMode
import com.kgd.quant.application.discover.RankingQuery
import com.kgd.quant.application.discover.GlobalIndexQuote
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * DiscoverController — 발견·트렌딩 endpoint (ADR-0042 PA).
 *
 * - GET /top-volume   거래대금 상위
 * - GET /top-gainers  상승률 상위
 * - GET /top-losers   하락률 상위
 * - GET /global-indices  글로벌 지수 8종 (마퀴 데이터)
 */
@RestController
@RequestMapping("/api/v1/discover")
class DiscoverController(
    private val rankingQuery: RankingQuery,
    private val globalIndicesQuery: GlobalIndicesQuery,
) {
    @GetMapping("/top-volume")
    suspend fun topVolume(
        @RequestParam(required = false) market: String?,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<List<MarketRanking>> =
        ApiResponse.success(rankingQuery.rank(RankingMode.TURNOVER, market, limit))

    @GetMapping("/top-gainers")
    suspend fun topGainers(
        @RequestParam(required = false) market: String?,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<List<MarketRanking>> =
        ApiResponse.success(rankingQuery.rank(RankingMode.GAINERS, market, limit))

    @GetMapping("/top-losers")
    suspend fun topLosers(
        @RequestParam(required = false) market: String?,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<List<MarketRanking>> =
        ApiResponse.success(rankingQuery.rank(RankingMode.LOSERS, market, limit))

    @GetMapping("/global-indices")
    suspend fun globalIndices(): ApiResponse<List<GlobalIndexQuote>> =
        ApiResponse.success(globalIndicesQuery.fetchAll())
}
