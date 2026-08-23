package com.kgd.ranking.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.ranking.application.dto.RankingBoardDetail
import com.kgd.ranking.application.dto.RankingBoardSummary
import com.kgd.ranking.application.dto.RankingScopeResponse
import com.kgd.ranking.application.dto.RouteGasSearchRequest
import com.kgd.ranking.application.dto.RouteGasSearchResponse
import com.kgd.ranking.application.service.RankingQueryService
import com.kgd.ranking.application.service.RouteGasSearchService
import com.kgd.ranking.domain.model.RankingDomain
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 랭킹 공개 API (ADR-0081).
 *
 * 응답의 `sourceLabel` 은 화면이 반드시 그린다 — 공공누리·KOGL 원천은 출처 표시가 의무다.
 */
@RestController
@RequestMapping("/api/v1/ranking")
class RankingController(
    private val rankingQueryService: RankingQueryService,
    private val routeGasSearchService: RouteGasSearchService,
) {

    @GetMapping("/boards")
    fun boards(
        @RequestParam(required = false) domain: RankingDomain?,
        @RequestParam(required = false) scope: String?,
    ): ApiResponse<List<RankingBoardSummary>> =
        ApiResponse.success(rankingQueryService.boards(domain, scope))

    @GetMapping("/boards/{slug}")
    fun board(@PathVariable slug: String): ApiResponse<RankingBoardDetail> =
        ApiResponse.success(rankingQueryService.board(slug))

    @GetMapping("/gas/areas")
    fun gasAreas(): ApiResponse<List<RankingScopeResponse>> =
        ApiResponse.success(rankingQueryService.scopes(RankingDomain.GAS_STATION))

    /**
     * 경로 위 주유소 찾기 — 이 서비스에서 유일하게 외부를 부르는 경로다(길찾기 1콜).
     * 주유소·가격은 매일 받아둔 우리 DB 만 읽는다.
     */
    @PostMapping("/gas/route")
    fun gasRoute(@RequestBody request: RouteGasSearchRequest): ApiResponse<RouteGasSearchResponse> =
        ApiResponse.success(routeGasSearchService.search(request))
}
