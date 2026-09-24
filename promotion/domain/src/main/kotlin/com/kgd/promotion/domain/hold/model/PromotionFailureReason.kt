package com.kgd.promotion.domain.hold.model

/** `promotion.hold.failed` 의 사유 — 사가가 분기하는 값이라 이름이 계약이다 */
enum class PromotionFailureReason {
    // 보류(reserve) 판정
    COUPON_NOT_FOUND,
    COUPON_NOT_OWNED,
    COUPON_NOT_AVAILABLE,
    COUPON_INACTIVE,
    COUPON_NOT_IN_PERIOD,
    COUPON_NOT_APPLICABLE,
    BELOW_MIN_ORDER_AMOUNT,

    /** 명령의 쿠폰 할인(주문서 견적)과 보류 시점 계산이 다르다 — 결제 금액이 맞지 않게 되므로 받지 않는다 */
    DISCOUNT_MISMATCH,
    INSUFFICIENT_POINTS,

    // 확정·취소·원복 판정
    EXPIRED,
    HOLD_NOT_FOUND,
    NOT_RESERVED,
    CANCELLED,
    ALREADY_CONFIRMED,
    NOT_CONFIRMED,
    RESTORE_EXCEEDS_USED,
}
