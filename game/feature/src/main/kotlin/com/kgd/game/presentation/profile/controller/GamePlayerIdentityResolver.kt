package com.kgd.game.presentation.profile.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.profile.port.GamePlayerOwner
import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

@Component
class GamePlayerIdentityResolver {
    companion object { const val COOKIE_NAME = "game_guest_token" }
    fun token(request: HttpServletRequest): String? = request.cookies
        ?.firstOrNull { it.name == COOKIE_NAME }?.value
        ?.takeIf { Regex("^[A-Za-z0-9_-]{43}$").matches(it) }
    fun issueToken(): String = ByteArray(32).also(SecureRandom()::nextBytes)
        .let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }
    fun owner(memberId: String?, token: String?): GamePlayerOwner = GamePlayerOwner(
        memberId = memberId?.let { it.toLongOrNull()?.takeIf { id -> id > 0 } ?: throw BusinessException(ErrorCode.UNAUTHORIZED) },
        guestTokenHash = token?.let { raw -> MessageDigest.getInstance("SHA-256")
            .digest(raw.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) } },
    )
}
