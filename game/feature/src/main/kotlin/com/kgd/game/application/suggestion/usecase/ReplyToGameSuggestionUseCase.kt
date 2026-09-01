package com.kgd.game.application.suggestion.usecase

import com.kgd.game.application.suggestion.dto.SuggestionReplyDto

/** 답글 — 제안을 쓴 본인과 운영자만 */
interface ReplyToGameSuggestionUseCase {
    fun execute(command: Command): SuggestionReplyDto

    data class Command(
        val slug: String,
        val suggestionId: Long,
        val memberId: Long,
        val isOperator: Boolean,
        val body: String,
    )
}
