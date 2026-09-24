package com.kgd.order.domain.benefit.model

import java.time.Instant

/** order 가 보는 포인트 잔액 — `promotion.point.changed` 의 balance 로 덮어쓴다. 행이 없으면 잔액 0 */
data class PointBalanceView(
    val memberId: String,
    val balance: Long,
    val occurredAt: Instant,
) {
    fun isSupersededBy(incoming: PointBalanceView): Boolean = !incoming.occurredAt.isBefore(occurredAt)
}
