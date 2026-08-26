package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation

interface CreateGameUseCase {
    fun execute(command: CreateGameCommand): GameDetailDto
}

data class CreateGameCommand(
    val slug: String,
    val title: String,
    val description: String,
    val thumbnailUrl: String,
    val coverUrl: String?,
    val engineType: EngineType,
    val loadType: LoadType,
    val entryUrl: String,
    val orientation: Orientation,
    val supportsMobile: Boolean,
    val developerName: String,
    val sdkIntegrated: Boolean,
    val genre: Genre,
    val tags: List<String>,
)
