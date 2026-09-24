package com.kgd.promotion.domain.coupon.model

import com.kgd.promotion.domain.coupon.exception.InvalidCouponStateException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

/** 사용자 쿠폰은 한 번만 쓰인다 — 확정된 쿠폰은 다른 주문에 다시 보류할 수 없다. */
class UserCouponTest : BehaviorSpec({
    val t0 = Instant.parse("2026-10-10T00:00:00Z")

    given("사용 확정된 쿠폰") {
        val coupon = UserCoupon.issue("7", 1L, t0)
        coupon.reserve(100L, t0)
        coupon.confirmUse(100L, t0)

        then("상태는 USED 이고 다른 주문에 보류할 수 없다") {
            coupon.status shouldBe UserCouponStatus.USED
            coupon.isUsable shouldBe false
            shouldThrow<InvalidCouponStateException> { coupon.reserve(200L, t0) }
            coupon.reservedOrderId shouldBe 100L
        }
    }

    given("보류 중인 쿠폰") {
        then("다른 주문으로 확정·해제할 수 없다") {
            val coupon = UserCoupon.issue("7", 1L, t0).also { it.reserve(100L, t0) }
            shouldThrow<InvalidCouponStateException> { coupon.confirmUse(200L, t0) }
            shouldThrow<InvalidCouponStateException> { coupon.release(200L, t0) }
            coupon.status shouldBe UserCouponStatus.RESERVED
        }
        then("해제하면 다시 쓸 수 있다") {
            val coupon = UserCoupon.issue("7", 1L, t0).also { it.reserve(100L, t0) }
            coupon.release(100L, t0)
            coupon.status shouldBe UserCouponStatus.AVAILABLE
            coupon.reservedOrderId shouldBe null
        }
    }

    given("전체 취소로 돌려받는 쿠폰") {
        fun used() = UserCoupon.issue("7", 1L, t0).also { it.reserve(100L, t0); it.confirmUse(100L, t0) }

        then("기간 안이면 RETURNED 로 다시 쓸 수 있다") {
            val coupon = used()
            coupon.returnAfterFullCancel(100L, stillValid = true, now = t0)
            coupon.status shouldBe UserCouponStatus.RETURNED
            coupon.isUsable shouldBe true
            coupon.reserve(300L, t0)
            coupon.status shouldBe UserCouponStatus.RESERVED
        }
        then("기간이 지났으면 EXPIRED 로 끝난다") {
            val coupon = used()
            coupon.returnAfterFullCancel(100L, stillValid = false, now = t0)
            coupon.status shouldBe UserCouponStatus.EXPIRED
            coupon.isUsable shouldBe false
        }
    }
})
