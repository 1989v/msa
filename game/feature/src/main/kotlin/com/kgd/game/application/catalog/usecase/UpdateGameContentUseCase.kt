package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameDetailDto

interface UpdateGameContentUseCase {
    fun execute(command: Command): GameDetailDto

    data class Command(val slug: String, val entryUrl: String, val sdkIntegrated: Boolean)
}
