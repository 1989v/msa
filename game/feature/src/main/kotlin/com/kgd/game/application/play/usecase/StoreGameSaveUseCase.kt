package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.port.SaveSnapshot

interface StoreGameSaveUseCase {
    fun execute(command: Command): SaveSnapshot

    data class Command(
        val slug: String,
        val memberId: Long?,
        val code: String?,
        val data: String,
        val expectedVersion: Long,
    )
}
