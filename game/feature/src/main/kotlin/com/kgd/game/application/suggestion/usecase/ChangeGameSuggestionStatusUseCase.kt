package com.kgd.game.application.suggestion.usecase

import com.kgd.game.application.suggestion.dto.AdminGameSuggestionDto
import com.kgd.game.domain.suggestion.model.SuggestionStatus

/** 처리 상태 변경 — 운영자만 */
interface ChangeGameSuggestionStatusUseCase {
    fun execute(command: Command): AdminGameSuggestionDto

    data class Command(
        val suggestionId: Long,
        val status: SuggestionStatus,
    )
}
