package com.kgd.game.presentation.play.controller

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.play.service.GameRunService
import com.kgd.game.application.play.service.GameSaveService
import jakarta.validation.constraints.PositiveOrZero
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 세이브 data 는 게임이 정의하는 불투명 JSON object — 서버는 스키마를 해석하지 않는다.
 * 바디 변환은 프레임워크(Jackson 3)가 하므로 순수 Map 으로 받고, 저장용 직렬화만 Jackson 2 로 수행.
 */
data class SaveStateResponse(val data: Map<String, Any?>?, val version: Long)

data class SaveRequest(
    val data: Map<String, Any?> = emptyMap(),
    @field:PositiveOrZero val version: Long = 0,
)

data class RunStartedResponse(val runKey: String, val seed: Long)

data class RunResponse(val runKey: String, val seed: Long, val status: String, val outcome: String?)

data class ConsumeRunRequest(val outcome: String? = null)

/** 클라우드 세이브(인증 필수 + X-Device-Id 리스) / 로그라이크 런(게스트 허용) */
@RestController
@RequestMapping("/api/v1/games/{slug}")
class GameSaveController(
    private val gameSaveService: GameSaveService,
    private val gameRunService: GameRunService,
) {
    private val mapper = ObjectMapper()
    private val mapType = object : TypeReference<Map<String, Any?>>() {}

    @GetMapping("/save")
    fun load(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-Device-Id") deviceId: String,
    ): ApiResponse<SaveStateResponse> {
        val snapshot = gameSaveService.load(slug, requireMember(userId), deviceId)
        return ApiResponse.success(
            SaveStateResponse(
                data = snapshot?.let { mapper.readValue(it.data, mapType) },
                version = snapshot?.version ?: 0,
            )
        )
    }

    @PutMapping("/save")
    fun store(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-Device-Id") deviceId: String,
        @Valid @RequestBody request: SaveRequest,
    ): ApiResponse<SaveStateResponse> {
        val saved = gameSaveService.store(
            slug = slug,
            memberId = requireMember(userId),
            holder = deviceId,
            data = mapper.writeValueAsString(request.data),
            expectedVersion = request.version,
        )
        return ApiResponse.success(
            SaveStateResponse(data = mapper.readValue(saved.data, mapType), version = saved.version)
        )
    }

    @PostMapping("/runs")
    fun startRun(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
    ): ApiResponse<RunStartedResponse> {
        val run = gameRunService.start(slug, userId?.toLongOrNull())
        return ApiResponse.success(RunStartedResponse(runKey = run.runKey, seed = run.seed))
    }

    @GetMapping("/runs/{runKey}")
    fun getRun(
        @PathVariable slug: String,
        @PathVariable runKey: String,
    ): ApiResponse<RunResponse> {
        val run = gameRunService.get(slug, runKey)
        return ApiResponse.success(
            RunResponse(runKey = run.runKey, seed = run.seed, status = run.status.name, outcome = run.outcome)
        )
    }

    @PostMapping("/runs/{runKey}/consume")
    fun consumeRun(
        @PathVariable slug: String,
        @PathVariable runKey: String,
        @RequestBody(required = false) request: ConsumeRunRequest?,
    ): ApiResponse<RunResponse> {
        val run = gameRunService.consume(slug, runKey, request?.outcome)
        return ApiResponse.success(
            RunResponse(runKey = run.runKey, seed = run.seed, status = run.status.name, outcome = run.outcome)
        )
    }

    private fun requireMember(userId: String?): Long =
        userId?.toLongOrNull() ?: throw BusinessException(ErrorCode.UNAUTHORIZED, "클라우드 세이브는 로그인이 필요합니다")
}
