package com.kgd.game.presentation.play.controller

import tools.jackson.core.type.TypeReference
import tools.jackson.databind.ObjectMapper
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.play.usecase.ConsumeGameRunUseCase
import com.kgd.game.application.play.usecase.GetGameRunUseCase
import com.kgd.game.application.play.usecase.LoadGameSaveUseCase
import com.kgd.game.application.play.usecase.StartGameRunUseCase
import com.kgd.game.application.play.usecase.StoreGameSaveUseCase
import jakarta.validation.constraints.PositiveOrZero
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 세이브 data 는 게임이 정의하는 불투명 JSON object — 서버는 스키마를 해석하지 않는다.
 * 바디 변환은 프레임워크(Jackson 3)가 하므로 순수 Map 으로 받고, 저장용 직렬화만 Jackson 2 로 수행.
 */
data class SaveStateResponse(val data: Map<String, Any?>?, val version: Long, val code: String? = null)

data class SaveRequest(
    val data: Map<String, Any?> = emptyMap(),
    @field:PositiveOrZero val version: Long = 0,
    /** 게스트가 기존 세이브를 이어 쓸 때 제시하는 이어하기 코드 */
    val code: String? = null,
)

data class RunStartedResponse(val runKey: String, val seed: Long)

data class RunResponse(val runKey: String, val seed: Long, val status: String, val outcome: String?)

data class ConsumeRunRequest(val outcome: String? = null)

/**
 * 클라우드 세이브 / 로그라이크 런 — 둘 다 게스트 허용.
 * 로그인 사용자는 X-User-Id 로, 게스트는 서버가 발급한 이어하기 코드로 세이브를 식별한다.
 */
@RestController
@RequestMapping("/api/v1/games/{slug}")
class GameSaveController(
    private val loadSave: LoadGameSaveUseCase,
    private val storeSave: StoreGameSaveUseCase,
    private val startRun: StartGameRunUseCase,
    private val getRun: GetGameRunUseCase,
    private val consumeRun: ConsumeGameRunUseCase,
) {
    private val mapper = ObjectMapper()
    private val mapType = object : TypeReference<Map<String, Any?>>() {}

    @GetMapping("/save")
    fun load(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestParam(required = false) code: String?,
    ): ApiResponse<SaveStateResponse> {
        val snapshot = loadSave.execute(LoadGameSaveUseCase.Query(slug, userId?.toLongOrNull(), code))
        return ApiResponse.success(
            SaveStateResponse(
                data = snapshot?.let { mapper.readValue(it.data, mapType) },
                version = snapshot?.version ?: 0,
                code = snapshot?.code,
            )
        )
    }

    @PutMapping("/save")
    fun store(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @Valid @RequestBody request: SaveRequest,
    ): ApiResponse<SaveStateResponse> {
        val saved = storeSave.execute(
            StoreGameSaveUseCase.Command(
                slug = slug,
                memberId = userId?.toLongOrNull(),
                code = request.code,
                data = mapper.writeValueAsString(request.data),
                expectedVersion = request.version,
            )
        )
        return ApiResponse.success(
            SaveStateResponse(data = mapper.readValue(saved.data, mapType), version = saved.version, code = saved.code)
        )
    }

    @PostMapping("/runs")
    fun startRun(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
    ): ApiResponse<RunStartedResponse> {
        val run = startRun.execute(StartGameRunUseCase.Command(slug, userId?.toLongOrNull()))
        return ApiResponse.success(RunStartedResponse(runKey = run.runKey, seed = run.seed))
    }

    @GetMapping("/runs/{runKey}")
    fun getRun(
        @PathVariable slug: String,
        @PathVariable runKey: String,
    ): ApiResponse<RunResponse> {
        val run = getRun.execute(GetGameRunUseCase.Query(slug, runKey))
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
        val run = consumeRun.execute(ConsumeGameRunUseCase.Command(slug, runKey, request?.outcome))
        return ApiResponse.success(
            RunResponse(runKey = run.runKey, seed = run.seed, status = run.status.name, outcome = run.outcome)
        )
    }
}
