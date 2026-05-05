package com.kgd.quant.application.port.security

/**
 * TwoFactorTokenStorePort — 2FA 검증 토큰 (5분 one-time) 저장 port (ADR-0037 TG-P3-11).
 *
 * 인프라 구현은 Redis (`quant:2fa:token:{userId}:{tokenHash}` TTL 5분).
 * 토큰은 SHA-256 hex (64자). UseCase 가 검증 성공 시 issue, 보호된 작업 (live-mode 토글 /
 * risk-limit 변경 / kill-switch 해제) 호출 시 redeem.
 *
 * `redeem` 은 동시에 atomically 검증 + 삭제 (one-time). Lua script 또는 GETDEL 사용.
 */
interface TwoFactorTokenStorePort {
    suspend fun issue(userId: Long, tokenHash: String, ttlSeconds: Long = DEFAULT_TTL_SECONDS)
    suspend fun redeem(userId: Long, tokenHash: String): Boolean

    companion object {
        const val DEFAULT_TTL_SECONDS = 300L
    }
}
