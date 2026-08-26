package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameSummaryDto
import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page

interface ListGamesUseCase {
    fun execute(query: Query): Page<GameSummaryDto>

    data class Query(val tag: String?, val genre: Genre?, val sort: GameSort, val page: Int, val size: Int)
}
