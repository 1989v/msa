package com.kgd.order.domain.sheet.model

/** 주문서를 만들거나 쓸 수 없는 이유 — 전부 422 로 나간다 */
enum class OrderSheetRejection {
    PRODUCT_UNAVAILABLE,
    SELLER_UNAVAILABLE,
    COUPON_NOT_FOUND,
    COUPON_NOT_USABLE,
    COUPON_INACTIVE,
    COUPON_NOT_IN_PERIOD,
    COUPON_NOT_APPLICABLE,
    BELOW_MIN_ORDER_AMOUNT,
    POINT_EXCEEDS_BALANCE,
    POINT_EXCEEDS_PAYABLE,
    EXPIRED,
    ALREADY_USED,
    NOT_OWNER,
}
