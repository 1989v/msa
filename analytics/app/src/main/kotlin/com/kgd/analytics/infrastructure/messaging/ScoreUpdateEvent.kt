package com.kgd.analytics.infrastructure.messaging

/**
 * analytics 가 발행하는 스코어 갱신 이벤트.
 *
 * Phase 2 (ADR-0050): ctrRaw/cvrRaw (디버그용 unsmoothed) + gmv7d/gmv30d 추가.
 * 현재 산출 로직은 raw 값과 동일한 값을 ctr/cvr 에 그대로 사용 — 베이지안 스무딩
 * 도입(별도 PR) 시 ctr/cvr 가 스무딩된 값으로 분기되고 ctrRaw/cvrRaw 가 원본 보존.
 * GMV 산출도 별도 PR — 현재는 default 0 발행.
 */
data class ScoreUpdateEvent(
    val productId: Long,
    val popularityScore: Double,
    val ctr: Double,
    val cvr: Double,
    val ctrRaw: Double = 0.0,
    val cvrRaw: Double = 0.0,
    val gmv7d: Double = 0.0,
    val gmv30d: Double = 0.0,
    val updatedAt: Long
)
