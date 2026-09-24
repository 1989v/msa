package com.kgd.gateway.config

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import reactor.core.publisher.Mono

@Configuration
class RateLimiterConfig {

    @Bean
    fun ipKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(exchange.request.remoteAddress?.address?.hostAddress ?: "unknown")
    }

    // @Primary so Spring Cloud Gateway's requestRateLimiterGatewayFilterFactory
    // picks this one by default when it asks for a single KeyResolver bean.
    // GatewayRouteConfig also references it explicitly by field name via
    // constructor injection, so the behaviour is unchanged.
    @Bean
    @Primary
    fun userKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(
            exchange.request.headers.getFirst("X-User-Id")
                ?: exchange.request.remoteAddress?.address?.hostAddress
                ?: "unknown"
        )
    }

    /**
     * 광고 공개 라우트 전용 — 방문자 IP 로 센다. 클러스터 안에서 remoteAddress 는 ingress 파드 IP
     * 하나라 그대로 쓰면 모든 방문자가 한 통을 나눠 쓴다. `CF-Connecting-IP` 는 Cloudflare 가 넣는
     * 값이고, 우회 호스트(rt)에서는 위조할 수 있으므로 광고 라우트는 Host 허용 목록과 함께 쓴다.
     */
    @Bean
    fun adsClientIpKeyResolver(): KeyResolver = KeyResolver { exchange ->
        Mono.just(
            exchange.request.headers.getFirst("CF-Connecting-IP")?.takeIf { it.isNotBlank() }
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
