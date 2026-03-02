package com.kgd.common.security

import io.jsonwebtoken.Claims
import io.jsonwebtoken.ExpiredJwtException
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.util.Date
import javax.crypto.SecretKey

@Component
class JwtUtil(private val props: JwtProperties) {

    private val key: SecretKey by lazy {
        Keys.hmacShaKeyFor(props.secret.toByteArray(Charsets.UTF_8))
    }

    fun generateAccessToken(userId: String, roles: List<String>): String =
        Jwts.builder()
            .claim("userId", userId)
            .claim("roles", roles)
            .claim("type", "access")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + props.accessExpiry * 1000L))
            .signWith(key)
            .compact()

    fun generateRefreshToken(userId: String): String =
        Jwts.builder()
            .claim("userId", userId)
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + props.refreshExpiry * 1000L))
            .signWith(key)
            .compact()

    fun parseToken(token: String): Claims =
        Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .payload

    fun isValid(token: String): Boolean =
        runCatching { parseToken(token) }.isSuccess

    fun isExpired(token: String): Boolean =
        try {
            parseToken(token)
            false
        } catch (e: ExpiredJwtException) {
            true
        } catch (e: JwtException) {
            false
        }

    fun extractUserId(token: String): String? =
        runCatching { parseToken(token)["userId"] as? String }.getOrNull()
}
