package com.kgd.gateway.filter

import com.kgd.gateway.security.JwtTokenValidator
import org.slf4j.LoggerFactory
import org.springframework.cloud.gateway.filter.GatewayFilter
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component

@Component
class AuthenticationGatewayFilter(
    private val jwtTokenValidator: JwtTokenValidator,
    private val redisTemplate: RedisTemplate<String, Any>
) : AbstractGatewayFilterFactory<AuthenticationGatewayFilter.Config>(Config::class.java) {

    private val log = LoggerFactory.getLogger(AuthenticationGatewayFilter::class.java)

    data class Config(val dummy: String = "")

    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        val request = exchange.request
        val authHeader = request.headers.getFirst(HttpHeaders.AUTHORIZATION)

        val token = jwtTokenValidator.extractFromHeader(authHeader)
        if (token == null) {
            log.warn("Missing or invalid Authorization header: ${request.uri}")
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return@GatewayFilter exchange.response.setComplete()
        }

        // JWT 블랙리스트 체크 (Fail-Open 정책: Redis 장애 시 허용)
        val isBlacklisted = runCatching {
            redisTemplate.hasKey("blacklist:$token") == true
        }.getOrDefault(false)

        if (isBlacklisted) {
            log.warn("Blacklisted token used: ${request.uri}")
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return@GatewayFilter exchange.response.setComplete()
        }

        val claims = jwtTokenValidator.validateAndExtract(token)
        if (claims == null) {
            log.warn("Invalid JWT token: ${request.uri}")
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return@GatewayFilter exchange.response.setComplete()
        }

        val userId = claims.get("userId", String::class.java) ?: ""
        @Suppress("UNCHECKED_CAST")
        val roles = (claims.get("roles", List::class.java) as? List<*>)?.joinToString(",") ?: ""

        val mutatedRequest = request.mutate()
            .header("X-User-Id", userId)
            .header("X-User-Roles", roles)
            .build()

        chain.filter(exchange.mutate().request(mutatedRequest).build())
    }
}
