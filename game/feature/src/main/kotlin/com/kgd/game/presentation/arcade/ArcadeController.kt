package com.kgd.game.presentation.arcade

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.arcade.SubmitCommand
import com.kgd.game.application.arcade.usecase.GetArcadeCatalogUseCase
import com.kgd.game.application.arcade.usecase.GetArcadeLeaderboardUseCase
import com.kgd.game.application.arcade.usecase.GetDailyChallengeUseCase
import com.kgd.game.application.arcade.usecase.StartArcadeSessionUseCase
import com.kgd.game.application.arcade.usecase.SubmitArcadeScoreUseCase
import com.kgd.game.domain.arcade.BoardKey
import com.kgd.game.domain.arcade.GameCatalogItem
import com.kgd.game.domain.arcade.LeaderboardPeriod
import com.kgd.game.domain.arcade.SessionId
import com.kgd.game.sim.InputCommand
import com.kgd.game.sim.InputEvent
import com.kgd.game.sim.ReplayLog
import java.time.LocalDate
import java.time.ZoneOffset
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/games/arcade")
class ArcadeController(
    private val startSession: StartArcadeSessionUseCase,
    private val submitScore: SubmitArcadeScoreUseCase,
    private val leaderboard: GetArcadeLeaderboardUseCase,
    private val catalog: GetArcadeCatalogUseCase,
    private val daily: GetDailyChallengeUseCase,
) {

    @GetMapping("/catalog")
    fun catalog(): ApiResponse<List<GameCatalogItem>> = ApiResponse.success(catalog.catalog())

    @PostMapping("/sessions")
    fun start(@RequestBody req: StartSessionRequest): ApiResponse<StartSessionResponse> {
        if (!catalog.isRegistered(req.gameId)) {
            return ApiResponse.error("UNKNOWN_GAME", "unknown game: ${req.gameId}")
        }
        val started = startSession.execute(StartArcadeSessionUseCase.Command(req.gameId, req.daily == true, today()))
        return ApiResponse.success(
            StartSessionResponse(started.sessionId.value, started.gameId, started.seed, started.dailyDate, started.token),
        )
    }

    @PostMapping("/scores")
    fun submit(@RequestBody req: SubmitScoreRequest): ApiResponse<SubmitScoreResponse> {
        val replay = ReplayLog(
            gameId = req.replay.gameId,
            seed = req.replay.seed,
            totalTicks = req.replay.totalTicks,
            inputs = req.replay.inputs.map { InputEvent(it.tick, parseCommand(it.command)) },
        )
        val outcome = submitScore.execute(
            SubmitCommand(SessionId(req.sessionId), req.token, req.claimedScore, replay, req.clientDurationMs, req.nickname),
        )
        return ApiResponse.success(
            SubmitScoreResponse(
                accepted = outcome.accepted,
                score = outcome.score,
                verification = outcome.verification.name,
                allTimeRank = outcome.allTimeRank,
                dailyRank = outcome.dailyRank,
                reason = outcome.reason,
            ),
        )
    }

    @GetMapping("/leaderboard")
    fun leaderboard(
        @RequestParam gameId: String,
        @RequestParam(defaultValue = "ALL_TIME") period: String,
        @RequestParam(required = false) date: String?,
    ): ApiResponse<List<LeaderboardEntryDto>> {
        val p = runCatching { LeaderboardPeriod.valueOf(period) }.getOrDefault(LeaderboardPeriod.ALL_TIME)
        val dateKey = if (p == LeaderboardPeriod.DAILY) (date ?: today()) else null
        val entries = leaderboard.top(BoardKey(gameId, p, dateKey), DEFAULT_LIMIT)
            .map { LeaderboardEntryDto(it.rank, it.nickname, it.score, it.status.name) }
        return ApiResponse.success(entries)
    }

    @GetMapping("/daily")
    fun dailyInfo(@RequestParam gameId: String): ApiResponse<DailyInfoDto> {
        val ch = daily.current(gameId, today())
        return ApiResponse.success(DailyInfoDto(ch.gameId, ch.date, ch.seed))
    }

    private fun parseCommand(raw: String): InputCommand =
        runCatching { InputCommand.valueOf(raw.uppercase()) }.getOrDefault(InputCommand.NONE)

    private fun today(): String = LocalDate.now(ZoneOffset.UTC).toString()

    companion object {
        private const val DEFAULT_LIMIT = 50
    }
}
