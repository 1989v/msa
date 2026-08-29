package com.kgd.game.presentation.play.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.play.dto.RatingResultDto
import com.kgd.game.application.play.dto.SessionEndedDto
import com.kgd.game.application.play.dto.SessionStartedDto
import com.kgd.game.application.play.dto.MyGameRecordDto
import com.kgd.game.application.play.usecase.EndGameSessionUseCase
import com.kgd.game.application.play.usecase.GetMyGameRecordUseCase
import com.kgd.game.application.play.usecase.RateGameUseCase
import com.kgd.game.application.play.usecase.StartGameSessionUseCase
import com.kgd.game.domain.play.model.DeviceType
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.web.bind.annotation.GetMapping
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
    private val startSession: StartGameSessionUseCase,
    private val endSession: EndGameSessionUseCase,
    private val myRecord: GetMyGameRecordUseCase,
    private val rateGame: RateGameUseCase,
) {

    /** 세션 시작 — 게스트 허용 (X-User-Id 없으면 memberId null) */
    @PostMapping("/sessions")
    fun startSession(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestBody(required = false) request: StartSessionRequest?,
    ): ApiResponse<SessionStartedDto> =
        ApiResponse.success(
            startSession.execute(
                StartGameSessionUseCase.Command(
                    slug = slug,
                    memberId = userId?.toLongOrNull(),
                    deviceType = request?.deviceType ?: DeviceType.DESKTOP,
                )
            )
        )

    @PatchMapping("/sessions/{sessionKey}")
    fun endSession(
        @PathVariable slug: String,
        @PathVariable sessionKey: String,
    ): ApiResponse<SessionEndedDto> =
        ApiResponse.success(endSession.execute(EndGameSessionUseCase.Command(sessionKey)))

    /**
     * 평점 upsert — 회원은 1인 1표, 비로그인은 **기기 1표**.
     * 게임 호스트에 로그인 진입점이 없어 로그인 필수 규칙이 기능을 죽이고 있었다.
     * 기기 표는 저장소를 비우면 우회되므로 조작 방지 장치가 아니다 — 참여를 여는 쪽을 택했고,
     * 표 수를 함께 노출해 표본이 작은 평점이 스스로 드러나게 한다.
     */
    /**
     * 내 기록 — 상세 화면의 개인 패널.
     *
     * **로그인 전용이다.** 게스트에게 빈 패널을 주면 "기록이 없다" 와 "로그인이 필요하다" 가
     * 구분되지 않는다. 화면은 로그인 상태일 때만 이걸 부르고, 아니면 로그인 안내를 대신 띄운다.
     */
    @GetMapping("/me")
    fun myRecord(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
    ): ApiResponse<MyGameRecordDto> {
        val memberId = userId?.toLongOrNull()
            ?: throw BusinessException(ErrorCode.UNAUTHORIZED, "로그인이 필요하다")
        return ApiResponse.success(myRecord.execute(GetMyGameRecordUseCase.Query(slug, memberId)))
    }

    @PutMapping("/rating")
    fun rate(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-Device-Id", required = false) deviceId: String?,
        @Valid @RequestBody request: RateRequest,
    ): ApiResponse<RatingResultDto> {
        val memberId = userId?.toLongOrNull()
        val device = deviceId?.trim()?.takeIf { it.isNotEmpty() && it.length <= 64 }
        if (memberId == null && device == null) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "평점 등록에는 회원 또는 기기 식별자가 필요합니다")
        }
        return ApiResponse.success(rateGame.execute(RateGameUseCase.Command(slug, memberId, device, request.score)))
    }
}
