package com.kgd.promotion.domain.hold.model

import java.time.Instant

/** 클레임 원복 한 번 — [restoreKey] 가 멱등 키(같은 클레임의 원복 명령이 두 번 와도 한 번만 되돌린다) */
data class HoldRestoration(
    val restoreKey: String,
    val orderId: Long,
    val points: Long,
    val couponReturned: Boolean,
    val createdAt: Instant,
)
