package com.kgd.game.application.suggestion.usecase

import com.kgd.game.application.suggestion.dto.GameSuggestionDto

/** 제안 등록 — 로그인 필수 */
interface CreateGameSuggestionUseCase {
    fun execute(command: Command): GameSuggestionDto

    data class Command(
        val slug: String,
        val memberId: Long,
        /** 랭킹에 남는 것과 같은 표시 이름 (`game_nickname`) */
        val nickname: String,
        val body: String,
    )
}
