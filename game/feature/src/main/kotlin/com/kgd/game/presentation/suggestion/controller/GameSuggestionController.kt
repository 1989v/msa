package com.kgd.game.presentation.suggestion.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.suggestion.dto.GameSuggestionDto
import com.kgd.game.application.suggestion.dto.SuggestionReplyDto
import com.kgd.game.application.suggestion.usecase.CreateGameSuggestionUseCase
import com.kgd.game.application.suggestion.usecase.EditGameSuggestionUseCase
import com.kgd.game.application.suggestion.usecase.ListGameSuggestionsUseCase
import com.kgd.game.application.suggestion.usecase.ReplyToGameSuggestionUseCase
import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.SuggestionReply
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.data.domain.Page
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class SuggestionCreateRequest(
    /** 랭킹에 남는 것과 같은 표시 이름 (`game_nickname`) */
    @field:NotBlank
    @field:Size(min = GameSuggestion.MIN_NICKNAME, max = GameSuggestion.MAX_NICKNAME)
    val nickname: String = "",
    @field:NotBlank
    @field:Size(min = GameSuggestion.MIN_BODY, max = GameSuggestion.MAX_BODY)
    val body: String = "",
)

data class SuggestionEditRequest(
    @field:NotBlank
    @field:Size(min = GameSuggestion.MIN_BODY, max = GameSuggestion.MAX_BODY)
    val body: String = "",
)

data class SuggestionReplyRequest(
    @field:NotBlank
    @field:Size(min = 1, max = SuggestionReply.MAX_BODY)
    val body: String = "",
)

/**
 * 게임별 개선 제안.
 *
 * 읽기는 공개, 쓰기는 로그인 필수다. 게이트웨이는 「로그인했는가」까지만 보고
 * 「내 글인가」·「운영자인가」는 여기서부터 도메인이 판정한다 — 소유권은 엣지가 알 수 없다.
 */
@RestController
@RequestMapping("/api/v1/games/{slug}/suggestions")
class GameSuggestionController(
    private val listSuggestions: ListGameSuggestionsUseCase,
    private val createSuggestion: CreateGameSuggestionUseCase,
    private val editSuggestion: EditGameSuggestionUseCase,
    private val replyToSuggestion: ReplyToGameSuggestionUseCase,
) {
    /** 목록 — 최신순. 로그인해서 보면 자기 글에만 `mine` 이 선다 */
    @GetMapping
    fun list(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestParam(required = false) status: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<Page<GameSuggestionDto>> =
        ApiResponse.success(
            listSuggestions.execute(
                ListGameSuggestionsUseCase.Query(
                    slug = slug,
                    status = SuggestionStatus.parse(status),
                    page = page,
                    size = size,
                    viewerId = userId?.toLongOrNull(),
                )
            )
        )

    @PostMapping
    fun create(
        @PathVariable slug: String,
        @RequestHeader("X-User-Id") userId: String,
        @Valid @RequestBody request: SuggestionCreateRequest,
    ): ApiResponse<GameSuggestionDto> =
        ApiResponse.success(
            createSuggestion.execute(
                CreateGameSuggestionUseCase.Command(
                    slug = slug,
                    memberId = memberId(userId),
                    nickname = request.nickname,
                    body = request.body,
                )
            )
        )

    /** 수정 — 쓴 본인만. 운영자도 남의 본문은 고치지 못한다 */
    @PutMapping("/{suggestionId}")
    fun edit(
        @PathVariable slug: String,
        @PathVariable suggestionId: Long,
        @RequestHeader("X-User-Id") userId: String,
        @Valid @RequestBody request: SuggestionEditRequest,
    ): ApiResponse<GameSuggestionDto> =
        ApiResponse.success(
            editSuggestion.execute(
                EditGameSuggestionUseCase.Command(
                    slug = slug,
                    suggestionId = suggestionId,
                    memberId = memberId(userId),
                    body = request.body,
                )
            )
        )

    /** 답글 — 제안을 쓴 본인과 운영자만 */
    @PostMapping("/{suggestionId}/replies")
    fun reply(
        @PathVariable slug: String,
        @PathVariable suggestionId: Long,
        @RequestHeader("X-User-Id") userId: String,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
        @Valid @RequestBody request: SuggestionReplyRequest,
    ): ApiResponse<SuggestionReplyDto> =
        ApiResponse.success(
            replyToSuggestion.execute(
                ReplyToGameSuggestionUseCase.Command(
                    slug = slug,
                    suggestionId = suggestionId,
                    memberId = memberId(userId),
                    isOperator = isOperator(roles),
                    body = request.body,
                )
            )
        )

    private fun memberId(userId: String): Long =
        userId.toLongOrNull() ?: throw BusinessException(ErrorCode.UNAUTHORIZED, "로그인이 필요합니다")

    /**
     * 게이트웨이가 토큰에서 꺼내 넣은 역할만 본다. 필터를 통과한 요청에서는 클라이언트가
     * 손으로 붙인 이 헤더가 덮어써지므로, 여기서 신뢰할 수 있는 값이다.
     */
    private fun isOperator(roles: String?): Boolean =
        roles?.split(",")?.any { it.trim() == ADMIN_ROLE } == true

    companion object {
        private const val ADMIN_ROLE = "ROLE_ADMIN"
    }
}
