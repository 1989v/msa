package com.kgd.game.application.suggestion.port

import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.SuggestionReply
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface GameSuggestionRepositoryPort {
    fun save(suggestion: GameSuggestion): GameSuggestion

    fun findById(id: Long): GameSuggestion?

    /**
     * 공개 목록과 어드민 목록이 같은 조회를 쓴다 — [gameId] 가 null 이면 전 게임 횡단이다.
     * 공개 경로는 반드시 게임을 하나 지정해 부른다(호출부가 가시성을 먼저 판정한다).
     */
    fun search(gameId: Long?, status: SuggestionStatus?, pageable: Pageable): Page<GameSuggestion>
}

interface SuggestionReplyRepositoryPort {
    fun save(reply: SuggestionReply): SuggestionReply

    /** 목록 한 페이지의 답글을 한 번에 — 제안마다 따로 부르면 N+1 이 된다 */
    fun findBySuggestionIds(suggestionIds: List<Long>): List<SuggestionReply>
}
