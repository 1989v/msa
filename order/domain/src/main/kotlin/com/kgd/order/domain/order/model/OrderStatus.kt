package com.kgd.order.domain.order.model

/**
 * 주문 상태 (스펙 SR-2). `COMPLETED` 는 구매 확정 — 취소되지 않은 라인이 전부 구매 확정된 주문이다.
 * 전이는 [canMoveTo] 의 표뿐이고, 도메인 메서드가 이 표로 가드한다.
 */
enum class OrderStatus {
    CREATED,
    PAYMENT_PENDING,
    PAID,
    CONFIRMED,
    FULFILLING,
    COMPLETED,
    CANCELLED,
    FAILED;

    fun canMoveTo(next: OrderStatus): Boolean = next in allowedNext

    /** 결제 대기 — 사용자당 개수 상한(SR-4)을 이 상태로 센다 */
    val awaitingPayment: Boolean get() = this == CREATED || this == PAYMENT_PENDING

    private val allowedNext: Set<OrderStatus>
        get() = when (this) {
            CREATED -> setOf(PAYMENT_PENDING, FAILED, CONFIRMED, CANCELLED)
            PAYMENT_PENDING -> setOf(PAID, FAILED)
            // PAID → FAILED 는 매입 전 보류 만료뿐 — 매입이 끝나면 CONFIRMED 로 넘어가 이 경로가 닫힌다
            PAID -> setOf(CONFIRMED, FAILED)
            CONFIRMED -> setOf(FULFILLING, CANCELLED)
            FULFILLING -> setOf(COMPLETED, CANCELLED)
            COMPLETED, CANCELLED, FAILED -> emptySet()
        }
}

/** 주문 라인 상태. 부분 취소는 주문 상태가 아니라 라인 상태와 주문의 환불 누계로 표현한다 */
enum class OrderLineStatus { ACTIVE, CANCELLED, PURCHASE_CONFIRMED }

/** 주문·사가가 실패(또는 구매자 취소)로 끝난 이유 — FE 가 안내 문구를 고르는 값이라 이름이 계약이다 */
enum class OrderFailureReason {
    /** 재고 예약 실패 */
    INSUFFICIENT_STOCK,

    /** 혜택 보류 실패 — FE 는 주문서 재생성을 안내한다 */
    BENEFIT_UNAVAILABLE,
    PAYMENT_DECLINED,

    /** 재고·혜택 보류가 결제 결론보다 먼저 만료됐다 */
    HOLD_EXPIRED,

    /** 피벗 전 기한(10분) 초과 */
    TIMEOUT,
    BUYER_CANCELLED,

    /** 옛 흐름의 PENDING 주문 — 전환 마이그레이션이 붙인다 */
    LEGACY_ABANDONED,
}
