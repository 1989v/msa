package com.kgd.game.application.arcade.usecase

import com.kgd.game.domain.arcade.BoardKey
import com.kgd.game.domain.arcade.LeaderboardEntry

/** 아케이드 순위표 조회. */
interface GetArcadeLeaderboardUseCase {
    fun top(board: BoardKey, limit: Int): List<LeaderboardEntry>
}
