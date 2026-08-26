package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameTagDto

interface ListGameTagsUseCase {
    fun execute(): List<GameTagDto>
}
