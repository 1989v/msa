package com.kgd.game.application.play.usecase

import com.kgd.game.domain.play.model.GameRun

interface ConsumeGameRunUseCase {
    fun execute(command: Command): GameRun

    data class Command(val slug: String, val runKey: String, val outcome: String?)
}
