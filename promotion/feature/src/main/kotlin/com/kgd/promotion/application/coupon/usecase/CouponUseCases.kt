package com.kgd.promotion.application.coupon.usecase

import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponDefinition
import com.kgd.promotion.domain.coupon.model.CouponDefinitionStatus
import com.kgd.promotion.domain.coupon.model.CouponType
import com.kgd.promotion.domain.coupon.model.UserCoupon
import com.kgd.promotion.domain.coupon.model.UserCouponStatus
import java.time.Instant

/** 어드민 쿠폰 정의 — 만들기·목록. 만든 뒤 조건은 바꾸지 않는다 */
interface ManageCouponDefinitionUseCase {
    fun create(command: Create): CouponDefinitionView
    fun list(page: Int, size: Int): CouponDefinitionPageView

    data class Create(
        val name: String,
        val type: CouponType,
        val amount: Long?,
        val rateBp: Int?,
        val maxDiscount: Long?,
        val minOrderAmount: Long,
        val validFrom: Instant,
        val validUntil: Instant,
        val issueLimit: Int,
        val bearer: CouponBearer,
        val sellerId: Long?,
        val actorId: String,
    )
}

/** 회원이 쿠폰을 스스로 받는다 — 발행 상한·1인 1장 */
interface ClaimCouponUseCase {
    fun claim(memberId: String, couponDefinitionId: Long): MyCouponView
}

interface GetMyCouponsUseCase {
    fun list(memberId: String): List<MyCouponView>
}

data class CouponDefinitionView(
    val id: Long,
    val name: String,
    val type: CouponType,
    val amount: Long?,
    val rateBp: Int?,
    val maxDiscount: Long?,
    val minOrderAmount: Long,
    val validFrom: Instant,
    val validUntil: Instant,
    val issueLimit: Int,
    val issuedCount: Int,
    val bearer: CouponBearer,
    val sellerId: Long?,
    val status: CouponDefinitionStatus,
) {
    companion object {
        fun from(d: CouponDefinition) = CouponDefinitionView(
            requireNotNull(d.id), d.name, d.type, d.amount, d.rateBp, d.maxDiscount, d.minOrderAmount, d.validFrom,
            d.validUntil, d.issueLimit, d.issuedCount, d.bearer, d.sellerId, d.status,
        )
    }
}

data class CouponDefinitionPageView(val items: List<CouponDefinitionView>, val total: Long)

/** 내 쿠폰 한 장 — 정의 조건을 함께 싣는다. [usable] 은 지금 주문에 쓸 수 있는지(상태 + 기간) */
data class MyCouponView(
    val userCouponId: Long,
    val status: UserCouponStatus,
    val usable: Boolean,
    val issuedAt: Instant,
    val definition: CouponDefinitionView,
) {
    companion object {
        fun of(c: UserCoupon, d: CouponDefinition, now: Instant) = MyCouponView(
            userCouponId = requireNotNull(c.id),
            status = c.status,
            usable = c.isUsable && d.isValidAt(now),
            issuedAt = c.issuedAt,
            definition = CouponDefinitionView.from(d),
        )
    }
}
