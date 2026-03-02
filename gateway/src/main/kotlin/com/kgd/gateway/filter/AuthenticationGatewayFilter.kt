package com.kgd.gateway.filter

import com.kgd.gateway.security.JwtTokenValidator
import org.slf4j.LoggerFactory
import org.springframework.cloud.gateway.filter.GatewayFilter
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import reactor.core.publisher.Mono

@Component
class AuthenticationGatewayFilter(
    private val jwtTokenValidator: JwtTokenValidator,
    private val redisTemplate: ReactiveRedisTemplate<String, Any>
) : AbstractGatewayFilterFactory<AuthenticationGatewayFilter.Config>(Config::class.java) {

    class Config

    private val log = LoggerFactory.getLogger(javaClass)

    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        val request = exchange.request
        val authHeader = request.headers.getFirst(HttpHeaders.AUTHORIZATION)
        val token = jwtTokenValidator.extractFromHeader(authHeader)

        if (token == null) {
            log.warn("Missing or invalid Authorization header: {}", request.uri)
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return@GatewayFilter exchange.response.setComplete()
        }

        // JWT 블랙리스트 체크 (Fail-Open 정책: Redis 장애 시 허용)
        redisTemplate.hasKey("blacklist:$token")
            .onErrorReturn(false)
            .flatMap { isBlacklisted ->
                if (isBlacklisted) {
                    log.warn("Blacklisted token used: {}", request.uri)
                    exchange.response.statusCode = HttpStatus.UNAUTHORIZED
                    exchange.response.setComplete()
                } else {
                    val claims = jwtTokenValidator.validateAndExtract(token)
                    if (claims == null) {
                        log.warn("Invalid JWT token: {}", request.uri)
                        exchange.response.statusCode = HttpStatus.UNAUTHORIZED
                        exchange.response.setComplete()
                    } else {
                        val userId = claims.get("userId", String::class.java) ?: ""
                        @Suppress("UNCHECKED_CAST")
                        val roles = (claims.get("roles", List::class.java) as? List<*>)
                            ?.joinToString(",") ?: ""
                        val mutatedRequest = request.mutate()
                            .header("X-User-Id", userId)
                            .header("X-User-Roles", roles)
                            .build()
                        chain.filter(exchange.mutate().request(mutatedRequest).build())
                    }
                }
            }
    }
}
