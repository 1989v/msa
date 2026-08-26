package com.kgd.game.application.arcade.usecase

import com.kgd.game.application.arcade.StartedSession

/** 세션 시작 — 서버가 seed(데일리면 공통, 자유면 랜덤) 발급 + 서명 토큰 */
interface StartArcadeSessionUseCase {
    fun execute(command: Command): StartedSession

    data class Command(val gameId: String, val isDaily: Boolean, val date: String)
}
