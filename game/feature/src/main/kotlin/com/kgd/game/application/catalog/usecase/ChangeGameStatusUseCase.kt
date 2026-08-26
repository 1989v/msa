package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameDetailDto

/** 상태 전이는 도메인 상태머신이 판정한다 */
interface ChangeGameStatusUseCase {
    fun execute(command: Command): GameDetailDto

    data class Command(val slug: String, val action: GameStatusAction)
}

enum class GameStatusAction { SUBMIT_REVIEW, LAUNCH_BETA, PUBLISH, SUSPEND, RESUME }
