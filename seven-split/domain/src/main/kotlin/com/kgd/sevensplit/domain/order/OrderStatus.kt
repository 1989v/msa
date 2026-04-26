package com.kgd.sevensplit.domain.order

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * Order 라이프사이클.
 *
 * 전이 테이블:
 *   ACCEPTED          → SUBMITTED | REJECTED | CANCELLED
 *   SUBMITTED         → PARTIALLY_FILLED | FILLED | REJECTED | CANCELLED
 *   PARTIALLY_FILLED  → PARTIALLY_FILLED | FILLED | CANCELLED
 *   FILLED / REJECTED / CANCELLED → (종료)
 *
 * TODO: ErrorCode.SEVEN_SPLIT_ILLEGAL_ORDER_TRANSITION 를 common 모듈에 추가.
 */
enum class OrderStatus {
    ACCEPTED,
    SUBMITTED,
    PARTIALLY_FILLED,
    FILLED,
    REJECTED,
    CANCELLED;

    fun ensureTransition(to: OrderStatus) {
        val allowed = when (this) {
            ACCEPTED -> to == SUBMITTED || to == REJECTED || to == CANCELLED
            SUBMITTED -> to == PARTIALLY_FILLED || to == FILLED || to == REJECTED || to == CANCELLED
            PARTIALLY_FILLED -> to == PARTIALLY_FILLED || to == FILLED || to == CANCELLED
            FILLED, REJECTED, CANCELLED -> false
        }
        if (!allowed) {
            throw BusinessException(
                errorCode = ErrorCode.INVALID_ORDER_STATUS,
                message = "Illegal order status transition: $this -> $to"
            )
        }
    }

    fun isTerminal(): Boolean = this == FILLED || this == REJECTED || this == CANCELLED
}
