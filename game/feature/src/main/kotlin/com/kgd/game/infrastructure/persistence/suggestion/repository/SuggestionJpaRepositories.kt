package com.kgd.game.infrastructure.persistence.suggestion.repository

import com.kgd.game.domain.suggestion.model.SuggestionStatus
import com.kgd.game.infrastructure.persistence.suggestion.entity.GameSuggestionJpaEntity
import com.kgd.game.infrastructure.persistence.suggestion.entity.SuggestionReplyJpaEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface GameSuggestionJpaRepository : JpaRepository<GameSuggestionJpaEntity, Long> {
    fun findByGameId(gameId: Long, pageable: Pageable): Page<GameSuggestionJpaEntity>
    fun findByGameIdAndStatus(gameId: Long, status: SuggestionStatus, pageable: Pageable): Page<GameSuggestionJpaEntity>
    fun findByStatus(status: SuggestionStatus, pageable: Pageable): Page<GameSuggestionJpaEntity>
}

interface SuggestionReplyJpaRepository : JpaRepository<SuggestionReplyJpaEntity, Long> {
    /**
     * `created_at` 은 초 단위(DATETIME)라 같은 초에 올라온 두 답글은 시각이 같다 —
     * 그때 순서를 정하는 것이 없으면 대화가 뒤집힌 채로 그려진다. id 로 못 박는다.
     */
    fun findBySuggestionIdInOrderByCreatedAtAscIdAsc(suggestionIds: List<Long>): List<SuggestionReplyJpaEntity>
}
