package com.kgd.promotion.domain.coupon.model

import com.kgd.promotion.domain.hold.model.PromotionFailureReason

/** 쿠폰을 이 주문에 적용한 결과 — 적용 못 하는 것은 예외가 아니라 사유다(보류 실패 이벤트로 나간다) */
sealed interface CouponEvaluation {
    data class Applicable(val discount: Long, val eligibleAmount: Long) : CouponEvaluation
    data class NotApplicable(val reason: PromotionFailureReason) : CouponEvaluation
}
