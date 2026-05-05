package com.kgd.quant.infrastructure.state

import com.kgd.quant.application.port.security.TwoFactorTokenStorePort
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * TG-P3-11 — Redis 기반 2FA 검증 토큰 store (ADR-0037).
 *
 * `issue` 는 SET key value EX ttlSeconds NX (이미 존재 시 덮어쓰지 않음 — replay 방지).
 * `redeem` 은 GETDEL (Redis 6.2+ atomic) — 한 번 redeem 하면 자동 삭제.
 *
 * Redis 6.2 미만 환경 fallback 은 Phase 4 검토.
 */
@Component
class RedisTwoFactorTokenStoreAdapter(
    private val redis: StringRedisTemplate,
) : TwoFactorTokenStorePort {

    override suspend fun issue(userId: Long, tokenHash: String, ttlSeconds: Long) =
        withContext(Dispatchers.IO) {
            redis.opsForValue().setIfAbsent(key(userId, tokenHash), "1", Duration.ofSeconds(ttlSeconds))
            Unit
        }

    override suspend fun redeem(userId: Long, tokenHash: String): Boolean = withContext(Dispatchers.IO) {
        // GETDEL atomic (Redis 6.2+)
        val v = redis.opsForValue().getAndDelete(key(userId, tokenHash))
        v == "1"
    }

    private fun key(userId: Long, tokenHash: String) = "quant:2fa:token:$userId:$tokenHash"
}
