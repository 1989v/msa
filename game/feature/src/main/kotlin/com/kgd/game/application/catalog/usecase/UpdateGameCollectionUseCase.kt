package com.kgd.game.application.catalog.usecase

import com.kgd.game.domain.catalog.model.GameCollection

interface UpdateGameCollectionUseCase {
    fun execute(command: Command): GameCollection

    data class Command(
        val slug: String,
        val title: String?,
        val displayOrder: Int?,
        val active: Boolean?,
        val gameIds: List<Long>?,
    )
}
