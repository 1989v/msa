package com.kgd.common.security

import io.jsonwebtoken.Claims
import io.jsonwebtoken.ExpiredJwtException
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.util.Date
import javax.crypto.SecretKey

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
        try {
            parseToken(token)
            true
        } catch (e: JwtException) {
            false
        }

    /**
     * 토큰이 만료되었는지 확인한다.
     * - 만료된 경우: `true`
     * - 유효한 경우: `false`
     * - 잘못된 토큰(변조/형식 오류) 인 경우: `false` (만료와 구분 불가 — `isValid()`로 선 검증 필요)
     */
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
