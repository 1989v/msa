package com.kgd.order.domain.order.model

import java.time.Instant

/** 주문 상태 이력 한 줄 — 저장소가 `order_status_history` 에 그대로 남긴다 */
data class StatusChange(
    val from: OrderStatus?,
    val to: OrderStatus,
    val reason: String?,
    val actor: String,
    val occurredAt: Instant,
) {
    companion object {
        /** 사가·스케줄러가 일으킨 전이의 주체 */
        const val SYSTEM = "SYSTEM"
    }
}
