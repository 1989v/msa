package com.kgd.game.application.profile.usecase

import com.kgd.game.application.profile.port.GamePlayerOwner
import com.kgd.game.application.profile.port.GamePlayerProfile

interface GamePlayerProfileUseCase {
    fun get(owner: GamePlayerOwner): GamePlayerProfile?
    fun save(owner: GamePlayerOwner, nickname: String): GamePlayerProfile
}
