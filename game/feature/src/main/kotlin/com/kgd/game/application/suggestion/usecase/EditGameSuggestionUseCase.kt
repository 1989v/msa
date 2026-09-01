package com.kgd.game.application.suggestion.usecase

import com.kgd.game.application.suggestion.dto.GameSuggestionDto

/** 제안 수정 — 쓴 본인만. 운영자도 남의 본문은 고치지 못한다 */
interface EditGameSuggestionUseCase {
    fun execute(command: Command): GameSuggestionDto

    data class Command(
        val slug: String,
        val suggestionId: Long,
        val memberId: Long,
        val body: String,
    )
}
