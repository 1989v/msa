package com.kgd.game.infrastructure.persistence.suggestion.adapter

import com.kgd.game.application.suggestion.port.GameSuggestionRepositoryPort
import com.kgd.game.application.suggestion.port.SuggestionReplyRepositoryPort
import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.SuggestionReply
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import com.kgd.game.infrastructure.persistence.suggestion.entity.GameSuggestionJpaEntity
import com.kgd.game.infrastructure.persistence.suggestion.entity.SuggestionReplyJpaEntity
import com.kgd.game.infrastructure.persistence.suggestion.repository.GameSuggestionJpaRepository
import com.kgd.game.infrastructure.persistence.suggestion.repository.SuggestionReplyJpaRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

@Component
class GameSuggestionRepositoryAdapter(
    private val repository: GameSuggestionJpaRepository,
) : GameSuggestionRepositoryPort {

    /**
     * 새 제안은 행을 만들고, 기존 제안은 **불러온 행에 옮겨 담는다**. 도메인 객체를 그대로
     * 엔티티로 바꿔 저장하면 `createdAt` 이 지금으로 덮여 「언제 올라온 제안인가」가 사라진다.
     */
    override fun save(suggestion: GameSuggestion): GameSuggestion {
        val id = suggestion.id ?: return repository.save(GameSuggestionJpaEntity.from(suggestion)).toDomain()
        val entity = repository.findById(id).orElse(null)
            ?: return repository.save(GameSuggestionJpaEntity.from(suggestion)).toDomain()
        entity.apply(suggestion)
        return repository.save(entity).toDomain()
    }

    override fun findById(id: Long): GameSuggestion? =
        repository.findById(id).orElse(null)?.toDomain()

    override fun search(gameId: Long?, status: SuggestionStatus?, pageable: Pageable): Page<GameSuggestion> {
        val page = when {
            gameId != null && status != null -> repository.findByGameIdAndStatus(gameId, status, pageable)
            gameId != null -> repository.findByGameId(gameId, pageable)
            status != null -> repository.findByStatus(status, pageable)
            else -> repository.findAll(pageable)
        }
        return page.map { it.toDomain() }
    }
}

@Component
class SuggestionReplyRepositoryAdapter(
    private val repository: SuggestionReplyJpaRepository,
) : SuggestionReplyRepositoryPort {

    override fun save(reply: SuggestionReply): SuggestionReply =
        repository.save(SuggestionReplyJpaEntity.from(reply)).toDomain()

    override fun findBySuggestionIds(suggestionIds: List<Long>): List<SuggestionReply> =
        if (suggestionIds.isEmpty()) emptyList()
        else repository.findBySuggestionIdInOrderByCreatedAtAscIdAsc(suggestionIds).map { it.toDomain() }
}
