package com.kgd.game.presentation.catalog.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.catalog.dto.GameCollectionDto
import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.dto.GameSummaryDto
import com.kgd.game.application.catalog.dto.GameTagDto
import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.application.catalog.usecase.GetGameCollectionsUseCase
import com.kgd.game.application.catalog.usecase.GetGameDetailUseCase
import com.kgd.game.application.catalog.usecase.GetSimilarGamesUseCase
import com.kgd.game.application.catalog.usecase.ListGameTagsUseCase
import com.kgd.game.application.catalog.usecase.ListGamesUseCase
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/games")
class GameController(
    private val listGames: ListGamesUseCase,
    private val getCollections: GetGameCollectionsUseCase,
    private val listTags: ListGameTagsUseCase,
    private val getDetail: GetGameDetailUseCase,
    private val getSimilar: GetSimilarGamesUseCase,
) {

    @GetMapping
    fun list(
        @RequestParam(required = false) tag: String?,
        @RequestParam(required = false) genre: String?,
        @RequestParam(required = false) sort: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "24") size: Int,
    ): ApiResponse<Page<GameSummaryDto>> =
        ApiResponse.success(
            listGames.execute(ListGamesUseCase.Query(tag, Genre.parse(genre), GameSort.parse(sort), page, size.coerceAtMost(100)))
        )

    @GetMapping("/collections")
    fun collections(): ApiResponse<List<GameCollectionDto>> =
        ApiResponse.success(getCollections.execute())

    @GetMapping("/tags")
    fun tags(): ApiResponse<List<GameTagDto>> =
        ApiResponse.success(listTags.execute())

    @GetMapping("/{slug}")
    fun detail(@PathVariable slug: String): ApiResponse<GameDetailDto> =
        ApiResponse.success(getDetail.execute(GetGameDetailUseCase.Query(slug)))

    @GetMapping("/{slug}/similar")
    fun similar(@PathVariable slug: String): ApiResponse<List<GameSummaryDto>> =
        ApiResponse.success(getSimilar.execute(GetSimilarGamesUseCase.Query(slug)))
}
