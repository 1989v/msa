package com.kgd.game.application.arcade.service

import com.kgd.game.application.arcade.usecase.GetArcadeCatalogUseCase
import com.kgd.game.application.arcade.usecase.GetArcadeLeaderboardUseCase
import com.kgd.game.application.arcade.usecase.GetDailyChallengeUseCase
import com.kgd.game.domain.arcade.BoardKey
import com.kgd.game.domain.arcade.DailyChallenge
import com.kgd.game.domain.arcade.DailyChallengePort
import com.kgd.game.domain.arcade.GameCatalogItem
import com.kgd.game.domain.arcade.GameRegistry
import com.kgd.game.domain.arcade.LeaderboardEntry
import com.kgd.game.domain.arcade.LeaderboardPort
import org.springframework.stereotype.Service

/** 아케이드 조회 3종. 컨트롤러가 포트를 직접 부르지 않도록 인바운드 경계를 준다. */
@Service
class ArcadeQueryService(
    private val registry: GameRegistry,
    private val leaderboard: LeaderboardPort,
    private val daily: DailyChallengePort,
) : GetArcadeCatalogUseCase, GetArcadeLeaderboardUseCase, GetDailyChallengeUseCase {

    override fun catalog(): List<GameCatalogItem> = registry.catalog()

    override fun isRegistered(gameId: String): Boolean = registry.module(gameId) != null

    override fun top(board: BoardKey, limit: Int): List<LeaderboardEntry> = leaderboard.top(board, limit)

    override fun current(gameId: String, date: String): DailyChallenge = daily.current(gameId, date)
}
