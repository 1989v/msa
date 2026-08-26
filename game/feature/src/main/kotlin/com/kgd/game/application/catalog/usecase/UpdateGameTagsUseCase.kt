package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameDetailDto

interface UpdateGameTagsUseCase {
    fun execute(command: Command): GameDetailDto

    data class Command(val slug: String, val tags: List<String>)
}
