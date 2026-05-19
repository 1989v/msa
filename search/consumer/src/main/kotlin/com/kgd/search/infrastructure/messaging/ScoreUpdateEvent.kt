package com.kgd.search.infrastructure.messaging

/**
 * analytics → search 의 스코어 동기 페이로드.
 *
 * Phase 2 (ADR-0050): ctrRaw/cvrRaw (디버그용 unsmoothed) + gmv7d/gmv30d 추가.
 * 기존 analytics 발행자가 새 필드를 발행하지 않는 동안은 default 0 으로 유지.
 */
data class ScoreUpdateEvent(
    val productId: Long = 0,
    val popularityScore: Double = 0.0,
    val ctr: Double = 0.0,
    val cvr: Double = 0.0,
    val ctrRaw: Double = 0.0,
    val cvrRaw: Double = 0.0,
    val gmv7d: Double = 0.0,
    val gmv30d: Double = 0.0,
    val updatedAt: Long = 0
)
