package com.kgd.game.presentation.play.controller

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.game.application.play.service.GameScoreService
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

data class ScoreSubmitRequest(
    @field:NotBlank val nickname: String = "",
    @field:PositiveOrZero val score: Long = 0,
    val detail: String? = null,
    /** 영구 강화를 적용한 런이면 "MODDED" — 생략하면 BASE */
    val track: String? = null,
)

data class ScoreSubmitResponse(val applied: Boolean, val rank: Int)

/** 게임별 랭킹 — 게스트 제출 허용. 닉네임당 최고 기록 1행 */
@RestController
@RequestMapping("/api/v1/games/{slug}")
class GameScoreController(
    private val gameScoreService: GameScoreService,
) {
    @PostMapping("/scores")
    fun submit(
        @PathVariable slug: String,
        @Valid @RequestBody request: ScoreSubmitRequest,
    ): ApiResponse<ScoreSubmitResponse> {
        val (applied, rank) =
            gameScoreService.submit(slug, ScoreTrack.from(request.track), request.nickname, request.score, request.detail)
        return ApiResponse.success(ScoreSubmitResponse(applied = applied, rank = rank))
    }

    @GetMapping("/leaderboard")
    fun leaderboard(
        @PathVariable slug: String,
        @RequestParam(defaultValue = "10") limit: Int,
        @RequestParam(required = false) track: String?,
    ): ApiResponse<List<ScoreEntry>> =
        ApiResponse.success(gameScoreService.leaderboard(slug, ScoreTrack.from(track), limit))
}
