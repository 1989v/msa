package com.kgd.game.presentation.territory.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.game.application.territory.usecase.TerritoryTicket
import com.kgd.game.application.territory.usecase.TerritoryTicketUseCase
import com.kgd.game.presentation.profile.controller.GamePlayerIdentityResolver
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController

@RestController
class TerritoryTicketController(
    private val tickets: TerritoryTicketUseCase,
    private val identity: GamePlayerIdentityResolver,
) {
    @PostMapping("/api/v1/games/territory/tickets")
    fun issue(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ApiResponse<TerritoryTicket> {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        return try {
            ApiResponse.success(tickets.issue(identity.owner(userId, identity.token(request))))
        } catch (e: IllegalArgumentException) {
            throw BusinessException(ErrorCode.INVALID_INPUT, e.message ?: "PROFILE_REQUIRED")
        } catch (e: IllegalStateException) {
            throw BusinessException(ErrorCode.INVALID_INPUT, e.message ?: "TICKET_CAPACITY")
        }
    }
}
