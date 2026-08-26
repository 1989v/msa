package com.kgd.game.application.catalog.usecase

import com.kgd.game.domain.catalog.model.GameCollection

interface ListGameCollectionsAdminUseCase {
    fun execute(): List<GameCollection>
}
