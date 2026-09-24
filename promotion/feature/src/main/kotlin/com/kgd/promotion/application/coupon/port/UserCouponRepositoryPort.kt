package com.kgd.promotion.application.coupon.port

import com.kgd.promotion.domain.coupon.model.UserCoupon

interface UserCouponRepositoryPort {
    /** 새 사용자 쿠폰. 같은 회원·정의가 이미 있으면 `CouponAlreadyIssuedException`(DB 유니크가 동시 요청도 막는다) */
    fun create(coupon: UserCoupon): UserCoupon
    fun save(coupon: UserCoupon): UserCoupon
    fun findById(id: Long): UserCoupon?
    fun existsByMemberIdAndDefinitionId(memberId: String, couponDefinitionId: Long): Boolean
    fun findAllByMemberId(memberId: String): List<UserCoupon>
}
