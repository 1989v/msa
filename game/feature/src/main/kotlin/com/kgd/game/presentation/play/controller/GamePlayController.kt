package com.kgd.game.presentation.play.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.play.dto.RatingResultDto
import com.kgd.game.application.play.dto.SessionEndedDto
import com.kgd.game.application.play.dto.SessionStartedDto
import com.kgd.game.application.play.service.GamePlayService
import com.kgd.game.domain.play.model.DeviceType
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class StartSessionRequest(val deviceType: DeviceType = DeviceType.DESKTOP)

data class RateRequest(
    @field:Min(1) @field:Max(10)
    val score: Int,
)

@RestController
@RequestMapping("/api/v1/games/{slug}")
class GamePlayController(
    private val gamePlayService: GamePlayService,
) {

    /** 세션 시작 — 게스트 허용 (X-User-Id 없으면 memberId null) */
    @PostMapping("/sessions")
    fun startSession(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestBody(required = false) request: StartSessionRequest?,
    ): ApiResponse<SessionStartedDto> =
        ApiResponse.success(
            gamePlayService.startSession(
                slug = slug,
                memberId = userId?.toLongOrNull(),
                deviceType = request?.deviceType ?: DeviceType.DESKTOP,
            )
        )

    @PatchMapping("/sessions/{sessionKey}")
    fun endSession(
        @PathVariable slug: String,
        @PathVariable sessionKey: String,
    ): ApiResponse<SessionEndedDto> =
        ApiResponse.success(gamePlayService.endSession(sessionKey))

    /** 평점 upsert — 인증 필수 (1인 1표) */
    @PutMapping("/rating")
    fun rate(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @Valid @RequestBody request: RateRequest,
    ): ApiResponse<RatingResultDto> {
        val memberId = userId?.toLongOrNull()
            ?: throw BusinessException(ErrorCode.UNAUTHORIZED, "평점 등록은 로그인이 필요합니다")
        return ApiResponse.success(gamePlayService.rate(slug, memberId, request.score))
    }
}
