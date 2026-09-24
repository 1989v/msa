package com.kgd.order.domain.benefit.model

import java.time.Instant

/**
 * order 가 보는 회원 쿠폰 — `promotion.coupon.issued` 로 생기고 `promotion.hold.*` 의 userCouponStatus 로 바뀐다.
 * 상태는 promotion 의 UserCouponStatus 문자열을 그대로 받는다.
 */
data class UserCouponView(
    val userCouponId: Long,
    val memberId: String,
    val couponDefinitionId: Long,
    val status: String,
    val occurredAt: Instant,
) {
    /** 보류·사용·소멸이 아닌 쿠폰만 주문서에 쓴다(최종 판정은 promotion reserve) */
    val isUsable: Boolean get() = status in USABLE

    fun isSupersededBy(incoming: UserCouponView): Boolean = !incoming.occurredAt.isBefore(occurredAt)

    companion object {
        private val USABLE = setOf("AVAILABLE", "RETURNED")
    }
}
