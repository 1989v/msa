package com.kgd.game.application.suggestion.usecase

import com.kgd.game.application.suggestion.dto.AdminGameSuggestionDto
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import org.springframework.data.domain.Page

/**
 * 어드민 목록 — 전 게임 횡단. 게임의 공개 상태와 무관하게 보여야 한다
 * (아직 DRAFT 인 게임의 제안도 처리 대상이다).
 */
interface ListGameSuggestionsAdminUseCase {
    fun execute(query: Query): Page<AdminGameSuggestionDto>

    data class Query(
        val gameId: Long?,
        val status: SuggestionStatus?,
        val page: Int,
        val size: Int,
    )
}
