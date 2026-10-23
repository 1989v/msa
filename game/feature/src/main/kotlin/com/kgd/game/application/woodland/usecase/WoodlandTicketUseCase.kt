package com.kgd.game.application.woodland.usecase

import com.kgd.game.application.profile.port.GamePlayerOwner
import com.kgd.game.application.profile.port.GamePlayerProfile

data class WoodlandTicket(val ticket: String, val expiresAt: Long)
interface WoodlandTicketUseCase {
    fun issue(owner: GamePlayerOwner): WoodlandTicket
    fun redeem(ticket: String): GamePlayerProfile?
}
