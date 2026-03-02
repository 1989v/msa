package com.kgd.gateway.security

import com.kgd.common.security.JwtUtil
import io.jsonwebtoken.Claims
import org.springframework.stereotype.Component

@Component
class JwtTokenValidator(private val jwtUtil: JwtUtil) {

    fun validateAndExtract(token: String): Claims? =
        if (jwtUtil.isValid(token)) runCatching { jwtUtil.parseToken(token) }.getOrNull()
        else null

    fun extractFromHeader(authHeader: String?): String? =
        authHeader
            ?.takeIf { it.startsWith("Bearer ", ignoreCase = true) }
            ?.substring(7)
            ?.trim()
}
