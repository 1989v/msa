package com.kgd.game.application.woodland.service

import com.kgd.game.application.profile.port.GamePlayerOwner
import com.kgd.game.application.profile.port.GamePlayerProfile
import com.kgd.game.application.profile.usecase.GamePlayerProfileUseCase
import com.kgd.game.application.woodland.usecase.WoodlandTicket
import com.kgd.game.application.woodland.usecase.WoodlandTicketUseCase
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.time.Clock
import java.util.Base64

@Service
class WoodlandTicketService(private val profiles: GamePlayerProfileUseCase, private val clock: Clock = Clock.systemUTC()) : WoodlandTicketUseCase {
    private data class Entry(val profile: GamePlayerProfile, val expiresAt: Long)
    private val tickets = LinkedHashMap<String, Entry>()
    private val random = SecureRandom()

    override fun issue(owner: GamePlayerOwner): WoodlandTicket {
        val profile = profiles.get(owner) ?: throw IllegalArgumentException("PROFILE_REQUIRED")
        return synchronized(tickets) {
            val now = clock.millis()
            tickets.entries.removeIf { it.value.expiresAt <= now || it.value.profile.playerId == profile.playerId }
            check(tickets.size < 4096) { "TICKET_CAPACITY" }
            val token = ByteArray(32).also(random::nextBytes)
                .let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }
            val expiry = now + 30_000
            tickets[token] = Entry(profile, expiry)
            WoodlandTicket(token, expiry)
        }
    }

    override fun redeem(ticket: String): GamePlayerProfile? = synchronized(tickets) {
        tickets.remove(ticket)?.takeIf { it.expiresAt > clock.millis() }?.profile
    }
}
