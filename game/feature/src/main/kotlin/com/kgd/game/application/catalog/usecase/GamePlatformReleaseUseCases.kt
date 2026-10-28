package com.kgd.game.application.catalog.usecase

import com.kgd.game.domain.catalog.model.GamePlatform
import com.kgd.game.domain.catalog.model.GamePlatformRelease
import com.kgd.game.domain.catalog.model.PlatformAudience
import com.kgd.game.domain.catalog.model.PlatformReleaseStatus

interface GetGamePlatformReleasesUseCase {
    fun execute(slug: String): List<GamePlatformRelease>
}
interface PutGamePlatformReleaseUseCase {
    data class Command(val slug: String, val platform: GamePlatform, val platformRef: String?,
        val releaseStatus: PlatformReleaseStatus, val audience: PlatformAudience)
    fun execute(command: Command): GamePlatformRelease
}
