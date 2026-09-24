package com.kgd.promotion.application.coupon.port

import com.kgd.promotion.domain.coupon.model.CouponDefinition
import com.kgd.promotion.domain.coupon.model.UserCoupon

/** order 읽기 모델용 — `promotion.coupon.defined`(키 정의 id) · `promotion.coupon.issued`(키 회원 id). 아웃박스 행이다 */
interface CouponEventPort {
    fun defined(definition: CouponDefinition)
    fun issued(coupon: UserCoupon)
}
