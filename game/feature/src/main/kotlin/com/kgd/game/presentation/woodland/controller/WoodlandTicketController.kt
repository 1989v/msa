package com.kgd.game.presentation.woodland.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.woodland.usecase.WoodlandTicketUseCase
import com.kgd.game.presentation.profile.controller.GamePlayerIdentityResolver
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.security.MessageDigest

@RestController
@ConditionalOnProperty(name = ["woodland.enabled"], havingValue = "true")
class WoodlandTicketController(
    private val tickets: WoodlandTicketUseCase,
    private val identity: GamePlayerIdentityResolver,
    @Value("\${woodland.bridge.secret:}") secret: String,
) {
    private val bridgeSecret = secret.toByteArray(Charsets.UTF_8)
    init { require(bridgeSecret.size >= 32) { "Woodland bridge secret must contain at least 32 bytes" } }

    @PostMapping("/api/v1/games/woodland/tickets")
    fun issue(@RequestHeader("X-User-Id", required = false) userId: String?, request: HttpServletRequest, response: HttpServletResponse): Any {
        response.setHeader("Cache-Control", "no-store")
        return try { ApiResponse.success(tickets.issue(identity.owner(userId, identity.token(request)))) }
        catch (e: IllegalArgumentException) { throw ResponseStatusException(HttpStatus.CONFLICT, "PROFILE_REQUIRED") }
        catch (e: IllegalStateException) { throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TICKET_CAPACITY") }
    }

    data class RedeemRequest(val ticket: String = "")
    @PostMapping("/internal/games/woodland/tickets/redeem")
    fun redeem(@RequestHeader("X-Woodland-Bridge", required = false) secret: String?, @RequestBody body: RedeemRequest, response: HttpServletResponse): Any {
        response.setHeader("Cache-Control", "no-store")
        if (!MessageDigest.isEqual(bridgeSecret, (secret ?: "").toByteArray(Charsets.UTF_8))) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "BRIDGE_AUTH_REQUIRED")
        }
        if (!Regex("[A-Za-z0-9_-]{43}").matches(body.ticket)) throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "TICKET_INVALID")
        return ApiResponse.success(tickets.redeem(body.ticket) ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "TICKET_INVALID"))
    }
}
