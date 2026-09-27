package com.kgd.game.presentation.profile.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.profile.port.GamePlayerProfile
import com.kgd.game.application.profile.usecase.GamePlayerProfileUseCase
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.core.env.Environment
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

data class GameNicknameRequest(val nickname: String = "")

@RestController
@RequestMapping("/api/v1/games/profile/me")
class GamePlayerProfileController(
    private val profiles: GamePlayerProfileUseCase,
    private val identity: GamePlayerIdentityResolver,
    private val environment: Environment,
) {
    @GetMapping
    fun get(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ApiResponse<GamePlayerProfile?> {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        return ApiResponse.success(profiles.get(identity.owner(userId, identity.token(request))))
    }

    @PutMapping
    fun save(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestBody body: GameNicknameRequest,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ApiResponse<GamePlayerProfile> {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        val previous = identity.token(request)
        val token = previous ?: if (userId == null) identity.issueToken() else null
        val profile = profiles.save(identity.owner(userId, token), body.nickname)
        if (userId == null && previous == null && token != null) {
            // TLS terminates at ingress; the gateway can use an internal HTTP host upstream.
            val forwardedHttps = request.getHeader("X-Forwarded-Proto")
                ?.substringBefore(',')?.trim()?.equals("https", ignoreCase = true) == true
            val secure = request.isSecure || forwardedHttps || request.serverName == "1989v.com" ||
                request.serverName.endsWith(".1989v.com") ||
                environment.activeProfiles.any { it in setOf("prod", "production") }
            val cookie = ResponseCookie.from(GamePlayerIdentityResolver.COOKIE_NAME, token)
                .httpOnly(true).secure(secure).sameSite("Lax").path("/api/v1/games")
                .maxAge(Duration.ofDays(365)).build()
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString())
        }
        return ApiResponse.success(profile)
    }
}
