package com.kgd.game.presentation.admin.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.suggestion.dto.AdminGameSuggestionDto
import com.kgd.game.application.suggestion.usecase.ChangeGameSuggestionStatusUseCase
import com.kgd.game.application.suggestion.usecase.ListGameSuggestionsAdminUseCase
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import org.springframework.data.domain.Page
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class SuggestionStatusChangeRequest(val status: String = "")

/**
 * 백오피스 — 처리 대기 목록과 상태 변경.
 *
 * 답글은 여기 없다. 어드민도 공개 경로(`POST /api/v1/games/{slug}/suggestions/{id}/replies`)로
 * 답글을 달고, 그 요청의 역할 헤더가 운영자 배지를 정한다 — 답글을 다는 길이 둘이면
 * 자격 판정도 둘이 된다.
 */
@RestController
@RequestMapping("/api/v1/admin/games/suggestions")
class GameSuggestionAdminController(
    private val listSuggestions: ListGameSuggestionsAdminUseCase,
    private val changeStatus: ChangeGameSuggestionStatusUseCase,
) {
    /** 전 게임 횡단 목록. 게임의 공개 상태와 무관하다 */
    @GetMapping
    fun list(
        @RequestParam(required = false) gameId: Long?,
        @RequestParam(required = false) status: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "30") size: Int,
    ): ApiResponse<Page<AdminGameSuggestionDto>> =
        ApiResponse.success(
            listSuggestions.execute(
                ListGameSuggestionsAdminUseCase.Query(
                    gameId = gameId,
                    status = SuggestionStatus.parse(status),
                    page = page,
                    size = size,
                )
            )
        )

    @PatchMapping("/{suggestionId}/status")
    fun changeStatus(
        @PathVariable suggestionId: Long,
        @RequestBody request: SuggestionStatusChangeRequest,
    ): ApiResponse<AdminGameSuggestionDto> {
        val status = SuggestionStatus.parse(request.status)
            ?: throw BusinessException(ErrorCode.INVALID_INPUT, "처리 상태를 지정해야 합니다")
        return ApiResponse.success(
            changeStatus.execute(ChangeGameSuggestionStatusUseCase.Command(suggestionId, status))
        )
    }
}
