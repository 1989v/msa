package com.kgd.game.application.suggestion.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.suggestion.dto.GameSuggestionDto
import com.kgd.game.application.suggestion.dto.SuggestionReplyDto
import com.kgd.game.application.suggestion.port.GameSuggestionRepositoryPort
import com.kgd.game.application.suggestion.port.SuggestionReplyRepositoryPort
import com.kgd.game.application.suggestion.usecase.CreateGameSuggestionUseCase
import com.kgd.game.application.suggestion.usecase.EditGameSuggestionUseCase
import com.kgd.game.application.suggestion.usecase.ReplyToGameSuggestionUseCase
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.suggestion.model.GameSuggestion
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 제안 쓰기 — 등록·수정·답글.
 *
 * 권한 판정은 전부 도메인이 한다 ([GameSuggestion.editBy], [GameSuggestion.reply]).
 * 서비스는 「어느 게임의 몇 번 제안인가」까지만 맞춰 준다 — 규칙이 두 군데로 갈리면
 * 한쪽만 고쳐도 다른 쪽이 통과시킨다.
 */
@Service
@Transactional(transactionManager = "gameTransactionManager")
class GameSuggestionService(
    private val games: GameRepositoryPort,
    private val suggestions: GameSuggestionRepositoryPort,
    private val replies: SuggestionReplyRepositoryPort,
) : CreateGameSuggestionUseCase, EditGameSuggestionUseCase, ReplyToGameSuggestionUseCase {

    override fun execute(command: CreateGameSuggestionUseCase.Command): GameSuggestionDto {
        val game = findVisibleGame(command.slug)
        val saved = suggestions.save(
            GameSuggestion.open(
                gameId = requireNotNull(game.id),
                memberId = command.memberId,
                nickname = command.nickname,
                body = command.body,
            )
        )
        return GameSuggestionDto.of(saved, emptyList(), viewerId = command.memberId)
    }

    override fun execute(command: EditGameSuggestionUseCase.Command): GameSuggestionDto {
        val suggestion = findInGame(command.slug, command.suggestionId)
        val edited = suggestions.save(suggestion.editBy(command.memberId, command.body))
        return GameSuggestionDto.of(
            suggestion = edited,
            replies = replies.findBySuggestionIds(listOf(command.suggestionId)),
            viewerId = command.memberId,
        )
    }

    override fun execute(command: ReplyToGameSuggestionUseCase.Command): SuggestionReplyDto {
        val suggestion = findInGame(command.slug, command.suggestionId)
        val reply = suggestion.reply(
            memberId = command.memberId,
            isOperator = command.isOperator,
            body = command.body,
        )
        return SuggestionReplyDto.from(replies.save(reply))
    }

    /**
     * 주소의 게임과 제안의 게임이 같은지 본다. 확인하지 않으면 아무 게임의 주소로 남의
     * 게임에 달린 제안을 열 수 있고, 그때 게임의 공개 여부 판정이 무의미해진다.
     */
    private fun findInGame(slug: String, suggestionId: Long): GameSuggestion {
        val game = findVisibleGame(slug)
        val suggestion = suggestions.findById(suggestionId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "제안을 찾을 수 없습니다")
        if (suggestion.gameId != game.id) {
            throw BusinessException(ErrorCode.NOT_FOUND, "제안을 찾을 수 없습니다")
        }
        return suggestion
    }

    /** DRAFT/REVIEW/SUSPENDED 는 존재 여부 은닉 — 카탈로그와 같은 판정이다 */
    private fun findVisibleGame(slug: String): Game {
        val game = games.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return game
    }
}
