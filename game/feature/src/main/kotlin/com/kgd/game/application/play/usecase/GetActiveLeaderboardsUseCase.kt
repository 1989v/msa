package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.dto.LeaderboardBoardDto

/** 허브 랭킹 레일 — 기록이 있는 보드만, 게임당 한 보드 */
interface GetActiveLeaderboardsUseCase {
    fun execute(query: Query): List<LeaderboardBoardDto>

    data class Query(val boardLimit: Int, val entryLimit: Int)
}
