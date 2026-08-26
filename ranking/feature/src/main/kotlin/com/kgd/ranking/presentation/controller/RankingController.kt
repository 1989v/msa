package com.kgd.ranking.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.ranking.application.ranking.dto.RankingBoardDetail
import com.kgd.ranking.application.ranking.dto.RankingBoardSummary
import com.kgd.ranking.application.ranking.dto.RankingScopeResponse
import com.kgd.ranking.application.ranking.usecase.GetRankingBoardUseCase
import com.kgd.ranking.application.ranking.usecase.GetRankingBoardsUseCase
import com.kgd.ranking.application.ranking.usecase.GetRankingScopesUseCase
import com.kgd.ranking.domain.model.RankingDomain
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
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
    private val getRankingBoards: GetRankingBoardsUseCase,
    private val getRankingBoard: GetRankingBoardUseCase,
    private val getRankingScopes: GetRankingScopesUseCase,
) {

    @GetMapping("/boards")
    fun boards(
        @RequestParam(required = false) domain: RankingDomain?,
        @RequestParam(required = false) scope: String?,
    ): ApiResponse<List<RankingBoardSummary>> =
        ApiResponse.success(getRankingBoards.execute(GetRankingBoardsUseCase.Query(domain, scope)))

    @GetMapping("/boards/{slug}")
    fun board(@PathVariable slug: String): ApiResponse<RankingBoardDetail> =
        ApiResponse.success(getRankingBoard.execute(slug))

    @GetMapping("/gas/areas")
    fun gasAreas(): ApiResponse<List<RankingScopeResponse>> =
        ApiResponse.success(getRankingScopes.execute(RankingDomain.GAS_STATION))
}
