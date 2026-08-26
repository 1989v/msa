package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameSummaryDto

interface GetSimilarGamesUseCase {
    fun execute(query: Query): List<GameSummaryDto>

    data class Query(val slug: String)
}
