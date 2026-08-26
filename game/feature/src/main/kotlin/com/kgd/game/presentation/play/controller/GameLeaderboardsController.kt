package com.kgd.game.presentation.play.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.play.dto.LeaderboardBoardDto
import com.kgd.game.application.play.usecase.GetActiveLeaderboardsUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 여러 게임의 랭킹을 한 번에 — 허브 상단 랭킹 레일용.
 *
 * 게임별 보드는 `/api/v1/games/{slug}/leaderboard` 가 이미 낸다. 허브는 게임이 60여 종이라
 * 그걸 게임 수만큼 부를 수 없고, 대부분의 게임에는 아직 기록이 없어 부른 만큼 빈 응답이 온다.
 * 그래서 "기록이 있는 보드"를 서버가 골라 한 번에 돌려준다.
 *
 * 경로가 `{slug}` 자리와 겹치지 않는 이유: 리터럴 경로가 템플릿보다 먼저 매칭된다.
 */
@RestController
@RequestMapping("/api/v1/games/leaderboards")
class GameLeaderboardsController(
    private val getActiveLeaderboards: GetActiveLeaderboardsUseCase,
) {
    @GetMapping
    fun activeBoards(
        @RequestParam(defaultValue = "8") boards: Int,
        @RequestParam(defaultValue = "3") entries: Int,
    ): ApiResponse<List<LeaderboardBoardDto>> =
        ApiResponse.success(getActiveLeaderboards.execute(GetActiveLeaderboardsUseCase.Query(boards, entries)))
}
