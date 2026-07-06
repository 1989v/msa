package com.kgd.game.presentation

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.StartSessionService
import com.kgd.game.application.SubmitCommand
import com.kgd.game.application.SubmitScoreService
import com.kgd.game.domain.BoardKey
import com.kgd.game.domain.DailyChallengePort
import com.kgd.game.domain.GameCatalogItem
import com.kgd.game.domain.GameRegistry
import com.kgd.game.domain.LeaderboardPeriod
import com.kgd.game.domain.LeaderboardPort
import com.kgd.game.domain.SessionId
import com.kgd.game.sim.InputCommand
import com.kgd.game.sim.InputEvent
import com.kgd.game.sim.ReplayLog
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.ZoneOffset

@RestController
@RequestMapping("/api/v1/game")
class GameController(
    private val startSession: StartSessionService,
    private val submitScore: SubmitScoreService,
    private val leaderboard: LeaderboardPort,
    private val registry: GameRegistry,
    private val daily: DailyChallengePort,
) {

    @GetMapping("/catalog")
    fun catalog(): ApiResponse<List<GameCatalogItem>> = ApiResponse.success(registry.catalog())

    @PostMapping("/sessions")
    fun start(@RequestBody req: StartSessionRequest): ApiResponse<StartSessionResponse> {
        if (registry.module(req.gameId) == null) {
            return ApiResponse.error("UNKNOWN_GAME", "unknown game: ${req.gameId}")
        }
        val started = startSession.start(req.gameId, req.daily, today())
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
        val outcome = submitScore.submit(
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
