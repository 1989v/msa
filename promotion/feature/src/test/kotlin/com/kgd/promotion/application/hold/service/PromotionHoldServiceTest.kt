package com.kgd.promotion.application.hold.service

import com.kgd.promotion.application.PromotionHarness
import com.kgd.promotion.application.T0
import com.kgd.promotion.application.hold.port.HoldCommand
import com.kgd.promotion.application.hold.port.HoldEventType
import com.kgd.promotion.application.hold.usecase.HoldAnswer
import com.kgd.promotion.application.hold.usecase.ProcessPromotionCommandUseCase
import com.kgd.promotion.domain.coupon.model.CouponLine
import com.kgd.promotion.domain.coupon.model.UserCouponStatus
import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import com.kgd.promotion.domain.hold.model.PromotionHoldStatus
import com.kgd.promotion.domain.point.model.PointLedgerType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

/**
 * 혜택 보류(TCC) — 실제 서비스·도메인에 저장소는 메모리, 이벤트는 기록 포트.
 * 판정 근거는 저장된 보류·쿠폰·잔액·원장 행과 발행된 이벤트다.
 */
class PromotionHoldServiceTest : BehaviorSpec({

    val lines = listOf(CouponLine(sellerId = 1L, amount = 20_000L))

    /** 회원 "7": 쿠폰 1장(1,000원) + 포인트 5,000 */
    fun setup(h: PromotionHarness = PromotionHarness()): Pair<PromotionHarness, Long> {
        val def = h.fixedCoupon()
        val coupon = h.claims.claim("7", requireNotNull(def.id))
        h.grant("7", 5_000L)
        return h to coupon.userCouponId
    }

    fun reserve(orderId: Long, userCouponId: Long?, points: Long = 3_000L, discount: Long = 1_000L) =
        ProcessPromotionCommandUseCase.Reserve(orderId, "7", userCouponId, if (userCouponId == null) 0L else discount, points, lines)

    given("같은 orderId 로 보류 명령이 두 번 온다") {
        then("보류 행 하나, 포인트는 한 번만 빠지고 원장 USE 한 줄, 쿠폰 RESERVED") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId)) shouldBe HoldAnswer(HoldEventType.RESERVED)
            h.holdService.reserve(reserve(100L, couponId)) shouldBe HoldAnswer(HoldEventType.RESERVED)

            h.holds.rows.values.count { it.orderId == 100L } shouldBe 1
            h.balanceOf("7") shouldBe 2_000L
            h.ledger.rows.count { it.type == PointLedgerType.USE } shouldBe 1
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.RESERVED
        }
    }

    given("잔액보다 많은 포인트로 보류") {
        then("failed(INSUFFICIENT_POINTS) — 잔액·쿠폰 그대로, 실패 행이 남아 같은 명령이 다시 와도 보류하지 않는다") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId, points = 5_001L)) shouldBe
                HoldAnswer(HoldEventType.FAILED, PromotionFailureReason.INSUFFICIENT_POINTS)
            h.balanceOf("7") shouldBe 5_000L
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.AVAILABLE

            h.grant("7", 10_000L) // 잔액이 생겨도 같은 orderId 는 이미 판정됐다
            h.holdService.reserve(reserve(100L, couponId, points = 5_001L)).reason shouldBe PromotionFailureReason.INSUFFICIENT_POINTS
            h.holds.findByOrderId(100L)!!.status shouldBe PromotionHoldStatus.FAILED
            h.balanceOf("7") shouldBe 15_000L
        }
    }

    given("사용자 쿠폰은 한 번만 쓰인다") {
        then("확정된 쿠폰으로 다른 주문을 보류하면 failed(COUPON_NOT_AVAILABLE)") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId))
            h.holdService.confirm(100L) shouldBe HoldAnswer(HoldEventType.CONFIRMED)
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.USED

            h.holdService.reserve(reserve(200L, couponId, points = 0L)) shouldBe
                HoldAnswer(HoldEventType.FAILED, PromotionFailureReason.COUPON_NOT_AVAILABLE)
        }
        then("견적 할인과 보류 시점 계산이 다르면 failed(DISCOUNT_MISMATCH)") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId, discount = 1_500L)).reason shouldBe PromotionFailureReason.DISCOUNT_MISMATCH
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.AVAILABLE
        }
    }

    given("보류 30분 만료") {
        then("29분 59초에는 그대로, 30분에 EXPIRED + promotion.hold.expired, 쿠폰·포인트가 풀린다") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId))

            h.clock.now = T0.plus(Duration.ofMinutes(30)).minusSeconds(1)
            h.expiry.expireDue() shouldBe 0

            h.clock.now = T0.plus(Duration.ofMinutes(30))
            h.expiry.expireDue() shouldBe 1
            h.holds.findByOrderId(100L)!!.status shouldBe PromotionHoldStatus.EXPIRED
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.AVAILABLE
            h.balanceOf("7") shouldBe 5_000L
            h.ledger.rows.single { it.type == PointLedgerType.USE_EXPIRE }.delta shouldBe 3_000L
            h.events.holds.single { it.type == HoldEventType.EXPIRED }.let {
                it.orderId shouldBe 100L
                it.command shouldBe HoldCommand.EXPIRE
                it.userCouponStatus shouldBe UserCouponStatus.AVAILABLE
            }
            h.expiry.expireDue() shouldBe 0
        }
    }

    given("만료된 보류에 확정 명령") {
        then("스케줄러보다 먼저 와도 예외 없이 expired + failed(EXPIRED), 쿠폰은 USED 가 되지 않는다") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId))
            h.clock.now = T0.plus(Duration.ofMinutes(31))

            h.holdService.confirm(100L) shouldBe HoldAnswer(HoldEventType.FAILED, PromotionFailureReason.EXPIRED)
            h.events.holds.filter { it.command == HoldCommand.CONFIRM }.map { it.type } shouldBe
                listOf(HoldEventType.EXPIRED, HoldEventType.FAILED)
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.AVAILABLE
            h.balanceOf("7") shouldBe 5_000L
        }
        then("스케줄러가 먼저 만료시켰으면 failed(EXPIRED) 만, 되돌림은 한 번뿐") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId))
            h.clock.now = T0.plus(Duration.ofMinutes(31))
            h.expiry.expireDue() shouldBe 1

            h.holdService.confirm(100L) shouldBe HoldAnswer(HoldEventType.FAILED, PromotionFailureReason.EXPIRED)
            h.ledger.rows.count { it.type == PointLedgerType.USE_EXPIRE } shouldBe 1
            h.balanceOf("7") shouldBe 5_000L
        }
    }

    given("보상 취소") {
        then("RESERVED 는 풀고 cancelled, 다시 와도 한 번만 풀린다") {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId))
            h.holdService.cancel(100L) shouldBe HoldAnswer(HoldEventType.CANCELLED)
            h.holdService.cancel(100L) shouldBe HoldAnswer(HoldEventType.CANCELLED)
            h.balanceOf("7") shouldBe 5_000L
            h.ledger.rows.count { it.type == PointLedgerType.USE_CANCEL } shouldBe 1
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.AVAILABLE
        }
        then("보류가 없어도 cancelled 로 답한다 — 보상 단계가 멈추지 않게") {
            val (h, _) = setup()
            h.holdService.cancel(999L) shouldBe HoldAnswer(HoldEventType.CANCELLED)
        }
    }

    given("클레임 원복 (포인트 3,000 · 쿠폰 사용 확정)") {
        fun confirmed(): Pair<PromotionHarness, Long> {
            val (h, couponId) = setup()
            h.holdService.reserve(reserve(100L, couponId))
            h.holdService.confirm(100L)
            return h to couponId
        }

        then("부분 취소: 포인트만 부분 원복, 쿠폰은 USED 그대로, 같은 restoreKey 는 한 번만") {
            val (h, couponId) = confirmed()
            val partial = ProcessPromotionCommandUseCase.Restore(100L, "claim-1", 1_000L, fullCancel = false)
            h.holdService.restore(partial) shouldBe HoldAnswer(HoldEventType.RESTORED)
            h.holdService.restore(partial) shouldBe HoldAnswer(HoldEventType.RESTORED)

            h.balanceOf("7") shouldBe 3_000L
            h.ledger.rows.count { it.type == PointLedgerType.RESTORE } shouldBe 1
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.USED
        }
        then("사용분을 넘는 원복은 failed(RESTORE_EXCEEDS_USED), 잔액 그대로") {
            val (h, _) = confirmed()
            h.holdService.restore(ProcessPromotionCommandUseCase.Restore(100L, "claim-1", 3_001L, fullCancel = false)) shouldBe
                HoldAnswer(HoldEventType.FAILED, PromotionFailureReason.RESTORE_EXCEEDS_USED)
            h.balanceOf("7") shouldBe 2_000L
        }
        then("전체 취소: 남은 포인트 원복 + 기간 안이면 쿠폰 RETURNED") {
            val (h, couponId) = confirmed()
            h.holdService.restore(ProcessPromotionCommandUseCase.Restore(100L, "claim-1", 1_000L, fullCancel = false))
            h.holdService.restore(ProcessPromotionCommandUseCase.Restore(100L, "claim-2", 2_000L, fullCancel = true))

            h.balanceOf("7") shouldBe 5_000L
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.RETURNED
            h.events.holds.last().let {
                it.type shouldBe HoldEventType.RESTORED
                it.restoredPoints shouldBe 2_000L
                it.userCouponStatus shouldBe UserCouponStatus.RETURNED
            }
        }
        then("전체 취소가 쿠폰 기간 종료 뒤면 쿠폰은 EXPIRED 로 끝난다") {
            val (h, couponId) = confirmed()
            h.clock.now = Instant.parse("2026-10-31T00:00:00Z")
            h.holdService.restore(ProcessPromotionCommandUseCase.Restore(100L, "claim-1", 3_000L, fullCancel = true))
            h.userCoupons.findById(couponId)!!.status shouldBe UserCouponStatus.EXPIRED
            h.balanceOf("7") shouldBe 5_000L
        }
    }
})
