package com.kgd.game.application.catalog.usecase

import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.GameCollection

interface CreateGameCollectionUseCase {
    fun execute(command: Command): GameCollection

    data class Command(
        val slug: String,
        val title: String,
        val type: CollectionType,
        val tagSlug: String?,
        val displayOrder: Int,
        val gameIds: List<Long>,
    )
}
