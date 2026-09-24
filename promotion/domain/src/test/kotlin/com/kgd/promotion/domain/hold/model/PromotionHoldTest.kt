package com.kgd.promotion.domain.hold.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

/** 혜택 보류(TCC) — 만료 경계, 만료 뒤 확정은 예외가 아니라 결과, 원복 한도·쿠폰 반환 1회. */
class PromotionHoldTest : BehaviorSpec({
    val t0 = Instant.parse("2026-10-10T00:00:00Z")
    val ttl = Duration.ofMinutes(30)

    fun reserved(userCouponId: Long? = 5L, points: Long = 3_000L) = PromotionHold.reserve(
        orderId = 100L, memberId = "7", userCouponId = userCouponId, couponDefinitionId = userCouponId?.let { 1L },
        couponDiscount = if (userCouponId != null) 1_000L else 0L, pointAmount = points, now = t0, holdDuration = ttl,
    )

    fun confirmed(userCouponId: Long? = 5L) = reserved(userCouponId).also { it.confirm(t0) }

    given("보류 기한 30분") {
        then("기한 1ms 전 확정은 CONFIRMED") {
            val hold = reserved()
            hold.expiresAt shouldBe t0.plus(ttl)
            hold.confirm(t0.plus(ttl).minusMillis(1)) shouldBe HoldConfirmResult.Confirmed
            hold.status shouldBe PromotionHoldStatus.CONFIRMED
        }
        then("기한 정각 확정은 그 자리에서 만료된다 — 예외가 아니라 결과") {
            val hold = reserved()
            hold.confirm(t0.plus(ttl)) shouldBe HoldConfirmResult.ExpiredNow
            hold.status shouldBe PromotionHoldStatus.EXPIRED
        }
        then("이미 만료된 보류에 확정 → Rejected(EXPIRED), 상태 그대로") {
            val hold = reserved().also { it.expire(t0.plus(ttl)) shouldBe true }
            hold.confirm(t0.plus(ttl)) shouldBe HoldConfirmResult.Rejected(PromotionFailureReason.EXPIRED)
            hold.status shouldBe PromotionHoldStatus.EXPIRED
        }
        then("기한 전에는 만료되지 않는다") {
            reserved().expire(t0.plus(ttl).minusMillis(1)) shouldBe false
        }
    }

    given("확정 뒤 취소") {
        then("보상 취소는 거부 — 원복(restore)으로 되돌린다") {
            confirmed().cancel(t0) shouldBe HoldCancelResult.Rejected(PromotionFailureReason.ALREADY_CONFIRMED)
        }
    }

    given("원복 (포인트 3,000 사용 · 쿠폰 있음)") {
        then("부분 원복은 남은 사용분까지 — 넘으면 거부, 쿠폰은 부분 취소로 돌아오지 않는다") {
            val hold = confirmed()
            hold.restore(1_000L, fullCancel = false, now = t0) shouldBe HoldRestoreResult.Restored(1_000L, returnCoupon = false)
            hold.restore(2_001L, fullCancel = false, now = t0) shouldBe
                HoldRestoreResult.Rejected(PromotionFailureReason.RESTORE_EXCEEDS_USED)
            hold.restoredPointAmount shouldBe 1_000L
            hold.status shouldBe PromotionHoldStatus.RESTORED
        }
        then("전체 취소는 쿠폰을 한 번만 돌려준다") {
            val hold = confirmed()
            hold.restore(3_000L, fullCancel = true, now = t0) shouldBe HoldRestoreResult.Restored(3_000L, returnCoupon = true)
            hold.restore(0L, fullCancel = true, now = t0) shouldBe HoldRestoreResult.Restored(0L, returnCoupon = false)
            hold.couponReturned shouldBe true
        }
        then("쿠폰 없이 쓴 보류는 전체 취소여도 돌려줄 쿠폰이 없다") {
            confirmed(userCouponId = null).restore(3_000L, fullCancel = true, now = t0) shouldBe
                HoldRestoreResult.Restored(3_000L, returnCoupon = false)
        }
        then("확정 전 보류는 원복 대상이 아니다") {
            reserved().restore(1_000L, fullCancel = false, now = t0) shouldBe
                HoldRestoreResult.Rejected(PromotionFailureReason.NOT_CONFIRMED)
        }
    }
})
