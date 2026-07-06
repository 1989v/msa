package com.kgd.game.presentation.catalog.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.catalog.dto.GameCollectionDto
import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.dto.GameSummaryDto
import com.kgd.game.application.catalog.dto.GameTagDto
import com.kgd.game.application.catalog.service.GameQueryService
import com.kgd.game.application.catalog.service.GameSort
import org.springframework.data.domain.Page
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/games")
class GameController(
    private val gameQueryService: GameQueryService,
) {

    @GetMapping
    fun list(
        @RequestParam(required = false) tag: String?,
        @RequestParam(required = false) sort: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "24") size: Int,
    ): ApiResponse<Page<GameSummaryDto>> =
        ApiResponse.success(gameQueryService.list(tag, GameSort.parse(sort), page, size.coerceAtMost(100)))

    @GetMapping("/collections")
    fun collections(): ApiResponse<List<GameCollectionDto>> =
        ApiResponse.success(gameQueryService.collections())

    @GetMapping("/tags")
    fun tags(): ApiResponse<List<GameTagDto>> =
        ApiResponse.success(gameQueryService.tags())

    @GetMapping("/{slug}")
    fun detail(@PathVariable slug: String): ApiResponse<GameDetailDto> =
        ApiResponse.success(gameQueryService.detail(slug))

    @GetMapping("/{slug}/similar")
    fun similar(@PathVariable slug: String): ApiResponse<List<GameSummaryDto>> =
        ApiResponse.success(gameQueryService.similar(slug))
}
