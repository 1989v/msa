package com.kgd.inventory.infrastructure.messaging.event

import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * Inbound event: consumed from order.order.completed topic.
 */
data class OrderCompletedEvent(
    val eventId: String = "",
    val orderId: Long = 0,
    val userId: String = "",
    val totalAmount: BigDecimal = BigDecimal.ZERO,
    val status: String = "",
    val items: List<OrderItemPayload> = emptyList(),
    val eventTime: LocalDateTime = LocalDateTime.now(),
)

data class OrderItemPayload(
    val productId: Long = 0,
    val quantity: Int = 0,
    val unitPrice: BigDecimal = BigDecimal.ZERO,
)

/**
 * Inbound event: consumed from `order.order.cancelled` topic (ADR-0032 Part 2 / PR-3).
 *
 * Order 측 publisher 의 schema 와 일치하며 [reason] / [cancelledAt] 은 forward-compatibility 를 위해
 * default 값을 가진다 (ADR-0014 event 진화 룰 — optional + default).
 *
 * 보상 흐름:
 * - `PAYMENT_FAILED`  : 결제 실패 시 inventory release 즉시 (본 PR 의 핵심 시나리오)
 * - `USER_CANCELLED`  : 사용자 취소 (별도 refund ADR 의존)
 * - `TIMEOUT` / `FRAUD` / `UNKNOWN` : 동일하게 inventory release
 *
 * Phase 2 (본 PR) 에서는 reason 분기를 두지 않고 모두 release 한다 — 멱등 use case 가 ACTIVE 만 처리하므로
 * `fulfillment.order.cancelled` 와의 race 도 자연 멱등 (release no-op) 으로 안전.
 */
data class OrderCancelledEvent(
    val eventId: String = "",
    val orderId: Long = 0,
    val userId: String = "",
    val reason: String = "UNKNOWN",
    val cancelledAt: LocalDateTime? = null,
    val eventTime: LocalDateTime = LocalDateTime.now(),
)
