package com.kgd.game.application.play.usecase

import com.kgd.game.domain.play.model.GameRun

interface GetGameRunUseCase {
    fun execute(query: Query): GameRun

    data class Query(val slug: String, val runKey: String)
}
