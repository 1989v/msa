package com.kgd.game.application.suggestion.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.suggestion.dto.AdminGameSuggestionDto
import com.kgd.game.application.suggestion.dto.SuggestionReplyDto
import com.kgd.game.application.suggestion.port.GameSuggestionRepositoryPort
import com.kgd.game.application.suggestion.port.SuggestionReplyRepositoryPort
import com.kgd.game.application.suggestion.usecase.ChangeGameSuggestionStatusUseCase
import com.kgd.game.application.suggestion.usecase.ListGameSuggestionsAdminUseCase
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.SuggestionReply
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 백오피스 — 처리 대기 목록과 상태 변경.
 *
 * 공개 목록과 달리 게임의 상태를 보지 않는다. 아직 DRAFT 인 게임에 달린 제안도 처리
 * 대상이고, 공개 API 로 안 보이는 것과 백오피스에서 안 보이는 것은 다른 이야기다
 * (카탈로그 어드민 조회와 같은 판단).
 */
@Service
@Transactional(transactionManager = "gameTransactionManager")
class GameSuggestionAdminService(
    private val games: GameRepositoryPort,
    private val suggestions: GameSuggestionRepositoryPort,
    private val replies: SuggestionReplyRepositoryPort,
) : ListGameSuggestionsAdminUseCase, ChangeGameSuggestionStatusUseCase {

    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    override fun execute(query: ListGameSuggestionsAdminUseCase.Query): Page<AdminGameSuggestionDto> {
        val pageable = PageRequest.of(
            query.page.coerceAtLeast(0),
            query.size.coerceIn(1, MAX_PAGE_SIZE),
            // 초 단위 시각이라 같은 초의 두 건은 시각이 같다 — id 가 순서를 못 박는다
            Sort.by(Sort.Direction.DESC, "createdAt", "id"),
        )
        val page = suggestions.search(query.gameId, query.status, pageable)
        if (page.isEmpty) return page.map { toAdminDto(it, null, emptyList()) }

        val gamesById = games.findByIds(page.content.map { it.gameId }.distinct()).associateBy { it.id }
        val repliesBySuggestion = replies
            .findBySuggestionIds(page.content.mapNotNull { it.id })
            .groupBy { it.suggestionId }
        return page.map {
            toAdminDto(it, gamesById[it.gameId], repliesBySuggestion[it.id].orEmpty())
        }
    }

    override fun execute(command: ChangeGameSuggestionStatusUseCase.Command): AdminGameSuggestionDto {
        val suggestion = suggestions.findById(command.suggestionId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "제안을 찾을 수 없습니다")
        val saved = suggestions.save(suggestion.changeStatus(command.status))
        return toAdminDto(
            suggestion = saved,
            game = games.findByIds(listOf(saved.gameId)).firstOrNull(),
            replies = replies.findBySuggestionIds(listOfNotNull(saved.id)),
        )
    }

    /**
     * 게임이 사라졌더라도 제안 행은 남으므로 표에서 빠지지 않게 한다 — 목록에서 조용히
     * 사라지면 처리하지 않은 제안이 있다는 사실 자체가 지워진다.
     */
    private fun toAdminDto(
        suggestion: GameSuggestion,
        game: Game?,
        replies: List<SuggestionReply>,
    ) = AdminGameSuggestionDto(
        id = suggestion.id ?: 0L,
        gameId = suggestion.gameId,
        gameSlug = game?.slug ?: "",
        gameTitle = game?.title ?: "(삭제된 게임)",
        nickname = suggestion.nickname,
        body = suggestion.body,
        status = suggestion.status,
        createdAt = suggestion.createdAt,
        updatedAt = suggestion.updatedAt,
        replies = replies.map(SuggestionReplyDto::from),
    )

    companion object {
        const val MAX_PAGE_SIZE = 100
    }
}
