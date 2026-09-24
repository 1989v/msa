package com.kgd.promotion.application.coupon.service

import com.kgd.promotion.application.PromotionHarness
import com.kgd.promotion.domain.coupon.exception.CouponAlreadyIssuedException
import com.kgd.promotion.domain.coupon.exception.CouponNotClaimableException
import com.kgd.promotion.domain.coupon.exception.CouponSoldOutException
import com.kgd.promotion.domain.coupon.model.UserCouponStatus
import com.kgd.promotion.domain.point.exception.InsufficientPointsException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

/** 쿠폰 발급 규칙 — 판정은 저장된 사용자 쿠폰 행과 정의의 발행 수다. 동시성은 commerce 통합 테스트(실제 MySQL)가 본다 */
class CouponClaimServiceTest : BehaviorSpec({

    given("발행 상한 2") {
        then("세 번째 회원은 소진, 발행 수는 2") {
            val h = PromotionHarness()
            val id = requireNotNull(h.fixedCoupon(limit = 2).id)
            h.claims.claim("a", id).status shouldBe UserCouponStatus.AVAILABLE
            h.claims.claim("b", id)
            shouldThrow<CouponSoldOutException> { h.claims.claim("c", id) }
            h.definitions.findById(id)!!.issuedCount shouldBe 2
            h.userCoupons.rows.size shouldBe 2
            h.events.issued.size shouldBe 2
        }
    }

    given("같은 회원이 두 번 받는다") {
        then("두 번째는 거부되고 발행 수는 1") {
            val h = PromotionHarness()
            val id = requireNotNull(h.fixedCoupon().id)
            h.claims.claim("a", id)
            shouldThrow<CouponAlreadyIssuedException> { h.claims.claim("a", id) }
            h.definitions.findById(id)!!.issuedCount shouldBe 1
        }
    }

    given("기간 밖의 정의") {
        then("받을 수 없다") {
            val h = PromotionHarness()
            val id = requireNotNull(h.fixedCoupon().id)
            h.clock.now = Instant.parse("2026-10-31T00:00:00Z")
            shouldThrow<CouponNotClaimableException> { h.claims.claim("a", id) }
            h.definitions.findById(id)!!.issuedCount shouldBe 0
        }
    }

    given("포인트 잔액") {
        then("원장 합이 잔액이고 음수로 내려가지 않는다") {
            val h = PromotionHarness()
            h.grant("a", 1_000L)
            h.grant("a", 500L)
            h.balanceOf("a") shouldBe 1_500L
            h.ledger.rows.sumOf { it.delta } shouldBe 1_500L
            shouldThrow<InsufficientPointsException> {
                h.recorder.record(h.balances.findByMemberId("a")!!) { it.use(1_501L, 1L, "hold-use:1", h.clock.now) }
            }
            h.balanceOf("a") shouldBe 1_500L
            h.pointService.get("a").recent.size shouldBe 2
        }
    }
})
