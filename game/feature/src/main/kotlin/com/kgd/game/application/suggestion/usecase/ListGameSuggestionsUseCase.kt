package com.kgd.game.application.suggestion.usecase

import com.kgd.game.application.suggestion.dto.GameSuggestionDto
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import org.springframework.data.domain.Page

/** 게임 상세의 개선 제안 목록 — 공개. 최신순 */
interface ListGameSuggestionsUseCase {
    fun execute(query: Query): Page<GameSuggestionDto>

    data class Query(
        val slug: String,
        val status: SuggestionStatus?,
        val page: Int,
        val size: Int,
        /** 보는 사람. 비로그인이면 null 이고, 그때 모든 항목의 `mine` 은 false 다 */
        val viewerId: Long?,
    )
}
