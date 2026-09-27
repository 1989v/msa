package com.kgd.game.application.profile.port

import com.kgd.game.domain.profile.model.GameNickname

data class GamePlayerProfile(val playerId: String, val nickname: String)

/** Trusted gateway member identity, or a hash of a server-issued guest credential. */
data class GamePlayerOwner(val memberId: Long? = null, val guestTokenHash: String? = null)

interface GamePlayerProfilePort {
    fun find(owner: GamePlayerOwner): GamePlayerProfile?
    fun findForUpdate(owner: GamePlayerOwner): GamePlayerProfile?
    fun save(owner: GamePlayerOwner, nickname: GameNickname): GamePlayerProfile
}
