package com.kgd.quant.application.port.security

/**
 * TwoFactorRateLimiterPort — 2FA brute force 방어 rate limiter (ADR-0037 TG-P3-12).
 *
 * 인프라 구현 (Redis Lua token bucket — Phase 2 ADR-0028 패턴 재활용):
 * - 사용자당 1분 윈도우에 5회 시도 허용
 * - 초과 시 [allow] = false → UseCase 가 즉시 거부 + AuditEvent(TWO_FA_FAILED)
 *
 * 도메인 의존성 없음 — 인프라 레이어가 Redis 키 (`quant:2fa:rate-limit:{userId}`) 관리.
 */
interface TwoFactorRateLimiterPort {
    suspend fun allow(userId: Long): Boolean
}
