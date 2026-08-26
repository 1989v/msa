package com.kgd.game.application.play.usecase

import com.kgd.game.domain.play.model.GameRun

/** 로그라이크 런 시작 — 서버가 시드를 발급한다 */
interface StartGameRunUseCase {
    fun execute(command: Command): GameRun

    data class Command(val slug: String, val memberId: Long?)
}
