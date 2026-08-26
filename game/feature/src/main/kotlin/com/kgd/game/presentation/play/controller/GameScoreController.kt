package com.kgd.game.presentation.play.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScorePeriod
import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.game.application.play.usecase.GetGameLeaderboardUseCase
import com.kgd.game.application.play.usecase.SubmitGameScoreUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.PositiveOrZero
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

data class ScoreSubmitRequest(
    @field:NotBlank val nickname: String = "",
    @field:PositiveOrZero val score: Long = 0,
    val detail: String? = null,
    /** 영구 강화를 적용한 런이면 "MODDED" — 생략하면 BASE */
    val track: String? = null,
    /**
     * 게임이 나눈 모드 키 — 생략하면 기본 보드다 (V59).
     * 모드가 하나뿐인 게임 60여 종은 이 값을 보내지 않고, 그 기록은 지금까지처럼 한 보드에 쌓인다.
     */
    val board: String? = null,
)

data class ScoreSubmitResponse(val applied: Boolean, val rank: Int)

/** 게임별 랭킹 — 게스트 제출 허용. 닉네임당 최고 기록 1행 */
@RestController
@RequestMapping("/api/v1/games/{slug}")
class GameScoreController(
    private val submitScore: SubmitGameScoreUseCase,
    private val getLeaderboard: GetGameLeaderboardUseCase,
) {
    @PostMapping("/scores")
    fun submit(
        @PathVariable slug: String,
        @Valid @RequestBody request: ScoreSubmitRequest,
    ): ApiResponse<ScoreSubmitResponse> {
        val (applied, rank) =
            submitScore.execute(
                SubmitGameScoreUseCase.Command(
                    slug = slug,
                    track = ScoreTrack.from(request.track),
                    board = ScoreBoardKey.from(request.board),
                    nickname = request.nickname,
                    score = request.score,
                    detail = request.detail,
                )
            )
        return ApiResponse.success(ScoreSubmitResponse(applied = applied, rank = rank))
    }

    /**
     * `period` / `date` 는 생략 가능하다 — 생략하면 역대 보드이고, 이건 게임 57종이 쓰는
     * 공용 위젯(`lib/rank.js`)이 이미 부르고 있는 계약 그대로다.
     * `date` 는 `period=DAILY` 에서만 뜻이 있고, 생략하면 KST 기준 오늘이다(`GameDay`).
     * `board` 도 생략 가능하고, 생략하면 모드를 나누지 않는 게임의 기본 보드다.
     */
    @GetMapping("/leaderboard")
    fun leaderboard(
        @PathVariable slug: String,
        @RequestParam(defaultValue = "10") limit: Int,
        @RequestParam(required = false) track: String?,
        @RequestParam(required = false) board: String?,
        @RequestParam(required = false) period: String?,
        @RequestParam(required = false) date: String?,
    ): ApiResponse<List<ScoreEntry>> =
        ApiResponse.success(
            getLeaderboard.execute(
                GetGameLeaderboardUseCase.Query(
                    slug = slug,
                    track = ScoreTrack.from(track),
                    limit = limit,
                    board = ScoreBoardKey.from(board),
                    period = ScorePeriod.from(period),
                    date = parseDate(date),
                ),
            ),
        )

    /** 못 읽는 날짜는 조용히 오늘로 넘기지 않는다 — 잘못된 날의 빈 보드는 "기록 없음"으로 위장된다 */
    private fun parseDate(raw: String?): LocalDate? =
        raw?.trim()?.takeIf { it.isNotEmpty() }?.let {
            runCatching { LocalDate.parse(it) }
                .getOrElse { throw BusinessException(ErrorCode.INVALID_INPUT, "날짜 형식 오류 (YYYY-MM-DD)") }
        }
}
