package com.kgd.game.application.territory.usecase

import com.kgd.game.application.profile.port.GamePlayerOwner
import com.kgd.game.application.profile.port.GamePlayerProfile

data class TerritoryTicket(val ticket: String, val expiresAt: Long, val wsPath: String = "/ws/games/territory")

interface TerritoryTicketUseCase {
    fun issue(owner: GamePlayerOwner): TerritoryTicket
    fun redeem(ticket: String): GamePlayerProfile?
}
