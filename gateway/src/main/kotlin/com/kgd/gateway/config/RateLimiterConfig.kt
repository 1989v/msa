package com.kgd.gateway.config

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import reactor.core.publisher.Mono

@Configuration
class RateLimiterConfig {

    @Bean
    fun ipKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(exchange.request.remoteAddress?.address?.hostAddress ?: "unknown")
    }

    @Bean
    fun userKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(
            exchange.request.headers.getFirst("X-User-Id")
                ?: exchange.request.remoteAddress?.address?.hostAddress
                ?: "unknown"
        )
    }

    /**
     * Redis Token Bucket Rate Limiter.
     * replenishRate: 100 tokens/sec
     * burstCapacity: 200 tokens (allows short bursts)
     * requestedTokens: 1 token per request
     *
     * Flash Sale 시 환경변수로 조절 가능 (재시작 필요).
     */
    @Bean
    fun redisRateLimiter(): RedisRateLimiter =
        RedisRateLimiter(100, 200, 1)
}
