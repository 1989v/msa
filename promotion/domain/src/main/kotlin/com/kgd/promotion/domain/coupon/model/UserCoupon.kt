package com.kgd.promotion.domain.coupon.model

import com.kgd.promotion.domain.coupon.exception.InvalidCouponStateException
import java.time.Instant

/**
 * 회원이 받은 쿠폰 한 장. 한 회원은 한 정의를 한 번만 받는다(DB 유니크).
 *
 * AVAILABLE·RETURNED → RESERVED(주문 보류) → USED(확정) · RESERVED → AVAILABLE(보류 해제·만료) ·
 * USED → RETURNED(전체 취소, 기간 안) | EXPIRED(전체 취소, 기간 밖). RETURNED 는 다시 쓸 수 있다.
 * 보류·확정·해제는 [reservedOrderId] 가 같은 주문일 때만 된다 — 다른 주문의 명령이 남의 보류를 풀지 못한다.
 */
class UserCoupon private constructor(
    val id: Long?,
    val memberId: String,
    val couponDefinitionId: Long,
    status: UserCouponStatus,
    reservedOrderId: Long?,
    val issuedAt: Instant,
    updatedAt: Instant,
) {
    var status: UserCouponStatus = status
        private set

    /** 보류·사용한 주문. 해제·반환되면 비운다 */
    var reservedOrderId: Long? = reservedOrderId
        private set
    var updatedAt: Instant = updatedAt
        private set

    val isUsable: Boolean get() = status == UserCouponStatus.AVAILABLE || status == UserCouponStatus.RETURNED

    fun reserve(orderId: Long, now: Instant) {
        if (!isUsable) throw InvalidCouponStateException(status, "RESERVE(order=$orderId)")
        status = UserCouponStatus.RESERVED
        reservedOrderId = orderId
        updatedAt = now
    }

    fun confirmUse(orderId: Long, now: Instant) {
        requireReservedFor(orderId, UserCouponStatus.RESERVED, "USE")
        status = UserCouponStatus.USED
        updatedAt = now
    }

    fun release(orderId: Long, now: Instant) {
        requireReservedFor(orderId, UserCouponStatus.RESERVED, "RELEASE")
        status = UserCouponStatus.AVAILABLE
        reservedOrderId = null
        updatedAt = now
    }

    /** 전체 취소 — 정의가 아직 유효하면 돌려주고, 지났으면 소멸로 끝낸다 */
    fun returnAfterFullCancel(orderId: Long, stillValid: Boolean, now: Instant) {
        requireReservedFor(orderId, UserCouponStatus.USED, "RETURN")
        status = if (stillValid) UserCouponStatus.RETURNED else UserCouponStatus.EXPIRED
        reservedOrderId = null
        updatedAt = now
    }

    private fun requireReservedFor(orderId: Long, expected: UserCouponStatus, action: String) {
        if (status != expected || reservedOrderId != orderId) {
            throw InvalidCouponStateException(status, "$action(order=$orderId, held=$reservedOrderId)")
        }
    }

    companion object {
        fun issue(memberId: String, couponDefinitionId: Long, now: Instant): UserCoupon {
            require(memberId.isNotBlank()) { "회원 id 가 비었습니다" }
            return UserCoupon(null, memberId, couponDefinitionId, UserCouponStatus.AVAILABLE, null, now, now)
        }

        fun restore(
            id: Long,
            memberId: String,
            couponDefinitionId: Long,
            status: UserCouponStatus,
            reservedOrderId: Long?,
            issuedAt: Instant,
            updatedAt: Instant,
        ) = UserCoupon(id, memberId, couponDefinitionId, status, reservedOrderId, issuedAt, updatedAt)
    }
}

enum class UserCouponStatus { AVAILABLE, RESERVED, USED, RETURNED, EXPIRED }
