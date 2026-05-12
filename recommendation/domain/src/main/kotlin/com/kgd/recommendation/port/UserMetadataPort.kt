package com.kgd.recommendation.port

/**
 * Cold-start fallback 시 user 의 선호 (city, category) 추정 — Phase 1 의 CB 로 폴백.
 *
 * Phase 3 PoC: ClickHouse recommendation_events 에서 사용자 행동의 가장 흔한 (city, category) 추론.
 * Phase 4+: member 서비스 + 사용자 demographics + onboarding 정보 결합.
 */
interface UserMetadataPort {
    fun inferPreferredContext(userId: Long): UserPreferredContext?
    fun getActionCount(userId: Long): Long
}

data class UserPreferredContext(
    val userId: Long,
    val cityId: Long,
    val categoryId: Long,
)
