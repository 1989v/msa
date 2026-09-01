package com.kgd.game.application.suggestion.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.suggestion.dto.GameSuggestionDto
import com.kgd.game.application.suggestion.port.GameSuggestionRepositoryPort
import com.kgd.game.application.suggestion.port.SuggestionReplyRepositoryPort
import com.kgd.game.application.suggestion.usecase.ListGameSuggestionsUseCase
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.suggestion.model.SuggestionReply
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 게임 상세의 제안 목록. 본문·상태·답글이 전부 공개라 로그인 없이도 읽을 수 있고,
 * 로그인해서 보면 자기 글에만 `mine` 이 선다.
 */
@Service
@Transactional(transactionManager = "gameTransactionManager", readOnly = true)
class GameSuggestionQueryService(
    private val games: GameRepositoryPort,
    private val suggestions: GameSuggestionRepositoryPort,
    private val replies: SuggestionReplyRepositoryPort,
) : ListGameSuggestionsUseCase {

    override fun execute(query: ListGameSuggestionsUseCase.Query): Page<GameSuggestionDto> {
        val game = findVisibleGame(query.slug)
        val pageable = PageRequest.of(
            query.page.coerceAtLeast(0),
            query.size.coerceIn(1, MAX_PAGE_SIZE),
            // 초 단위 시각이라 같은 초의 두 건은 시각이 같다 — id 가 순서를 못 박는다
            Sort.by(Sort.Direction.DESC, "createdAt", "id"),
        )
        val page = suggestions.search(game.id, query.status, pageable)
        val repliesBySuggestion = repliesOf(page.content.mapNotNull { it.id })
        return page.map { suggestion ->
            GameSuggestionDto.of(
                suggestion = suggestion,
                replies = repliesBySuggestion[suggestion.id].orEmpty(),
                viewerId = query.viewerId,
            )
        }
    }

    private fun repliesOf(suggestionIds: List<Long>): Map<Long, List<SuggestionReply>> =
        if (suggestionIds.isEmpty()) emptyMap()
        else replies.findBySuggestionIds(suggestionIds).groupBy { it.suggestionId }

    /** DRAFT/REVIEW/SUSPENDED 는 존재 여부 은닉 — 카탈로그와 같은 판정이다 */
    private fun findVisibleGame(slug: String): Game {
        val game = games.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return game
    }

    companion object {
        const val MAX_PAGE_SIZE = 50
    }
}
