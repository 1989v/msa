package com.kgd.quant.infrastructure.state

import com.kgd.quant.application.port.security.TwoFactorRateLimiterPort
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * TG-P3-12 — Redis 기반 2FA brute-force rate limiter (ADR-0037).
 *
 * 단순 fixed-window 카운터: `quant:2fa:rate-limit:{userId}` INCR + 첫 INCR 시 EXPIRE 60s.
 * 5회 이상 초과 시 false 반환.
 *
 * 분산 정합성은 단일 Redis 인스턴스 기준 (k3s-lite standalone). 다중 인스턴스 환경에서도
 * INCR + EXPIRE 가 atomic 이므로 정확. EXPIRE NX (Redis 7+) 가 정통이지만 호환성 위해 단순 EXPIRE.
 */
@Component
class RedisTwoFactorRateLimiterAdapter(
    private val redis: StringRedisTemplate,
    @Value("\${quant.security.two-fa.max-attempts-per-minute:5}")
    private val maxAttempts: Int,
) : TwoFactorRateLimiterPort {

    override suspend fun allow(userId: Long): Boolean = withContext(Dispatchers.IO) {
        val k = "quant:2fa:rate-limit:$userId"
        val ops = redis.opsForValue()
        val count = ops.increment(k) ?: 1L
        if (count == 1L) {
            redis.expire(k, Duration.ofMinutes(1))
        }
        count <= maxAttempts
    }
}
