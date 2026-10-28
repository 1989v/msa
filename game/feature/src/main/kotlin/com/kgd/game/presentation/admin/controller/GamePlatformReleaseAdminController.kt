package com.kgd.game.presentation.admin.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.catalog.usecase.GetGameDetailAdminUseCase
import com.kgd.game.application.catalog.usecase.GetGamePlatformReleasesUseCase
import com.kgd.game.application.catalog.usecase.PutGamePlatformReleaseUseCase
import com.kgd.game.domain.catalog.model.GamePlatform
import com.kgd.game.domain.catalog.model.GamePlatformRelease
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.PlatformAudience
import com.kgd.game.domain.catalog.model.PlatformReleaseStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class PutGamePlatformReleaseRequest(
    val platformRef: String?, val releaseStatus: PlatformReleaseStatus, val audience: PlatformAudience,
)
data class AdminGamePlatformReleaseResponse(
    val platform: GamePlatform, val platformRef: String?, val releaseStatus: PlatformReleaseStatus,
    val audience: PlatformAudience, val url: String?, val visible: Boolean,
)

/** Same gateway ROLE_ADMIN boundary as the existing game catalog admin API. */
@RestController
@RequestMapping("/api/v1/admin/games/{slug}/platform-releases")
class GamePlatformReleaseAdminController(
    private val getReleases: GetGamePlatformReleasesUseCase,
    private val putRelease: PutGamePlatformReleaseUseCase,
    private val getGame: GetGameDetailAdminUseCase,
) {
    @GetMapping
    fun get(@PathVariable slug: String): ApiResponse<List<AdminGamePlatformReleaseResponse>> {
        val playable = isPlayable(slug)
        return ApiResponse.success(getReleases.execute(slug).map { it.response(playable) })
    }
    @PutMapping("/{platform}")
    fun put(@PathVariable slug: String, @PathVariable platform: GamePlatform,
        @RequestBody request: PutGamePlatformReleaseRequest): ApiResponse<AdminGamePlatformReleaseResponse> =
        ApiResponse.success(putRelease.execute(PutGamePlatformReleaseUseCase.Command(slug, platform,
            request.platformRef, request.releaseStatus, request.audience)).response(isPlayable(slug)))
    private fun isPlayable(slug: String): Boolean = getGame.execute(GetGameDetailAdminUseCase.Query(slug)).status in
        setOf(GameStatus.BETA, GameStatus.PUBLISHED)
    private fun GamePlatformRelease.response(playable: Boolean) = AdminGamePlatformReleaseResponse(
        platform, platformRef, releaseStatus, audience, canonicalUrl(), playable && isPublic())
}
