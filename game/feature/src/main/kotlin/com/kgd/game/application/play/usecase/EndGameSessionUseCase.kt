package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.dto.SessionEndedDto

interface EndGameSessionUseCase {
    fun execute(command: Command): SessionEndedDto

    data class Command(val sessionKey: String)
}
