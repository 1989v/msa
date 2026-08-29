package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.ReleaseNoteDto

interface GetGameReleaseNotesUseCase {
    fun execute(query: Query): List<ReleaseNoteDto>

    data class Query(val slug: String)
}
