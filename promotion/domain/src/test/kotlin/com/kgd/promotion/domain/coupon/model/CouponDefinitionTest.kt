package com.kgd.promotion.domain.coupon.model

import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

/** 쿠폰 할인 계산 — 원 단위 값으로 판정한다(정률 내림 · 최대 할인 · 최소 주문 금액 · 기간 경계 · 판매자 쿠폰 대상). */
class CouponDefinitionTest : BehaviorSpec({

    val from = Instant.parse("2026-10-01T00:00:00Z")
    val until = Instant.parse("2026-10-31T00:00:00Z")
    val inPeriod = Instant.parse("2026-10-10T00:00:00Z")

    fun rate(rateBp: Int, maxDiscount: Long, minOrder: Long = 0L) = CouponDefinition.create(
        name = "정률", type = CouponType.RATE, amount = null, rateBp = rateBp, maxDiscount = maxDiscount,
        minOrderAmount = minOrder, validFrom = from, validUntil = until, issueLimit = 10,
        bearer = CouponBearer.PLATFORM, sellerId = null, createdBy = "1", now = from,
    )

    fun fixed(amount: Long, minOrder: Long = 0L, bearer: CouponBearer = CouponBearer.PLATFORM, sellerId: Long? = null) =
        CouponDefinition.create(
            name = "정액", type = CouponType.FIXED, amount = amount, rateBp = null, maxDiscount = null,
            minOrderAmount = minOrder, validFrom = from, validUntil = until, issueLimit = 10,
            bearer = bearer, sellerId = sellerId, createdBy = "1", now = from,
        )

    fun lines(vararg amounts: Pair<Long, Long>) = amounts.map { (seller, amount) -> CouponLine(seller, amount) }

    fun discount(e: CouponEvaluation): Long = (e as CouponEvaluation.Applicable).discount
    fun reason(e: CouponEvaluation): PromotionFailureReason = (e as CouponEvaluation.NotApplicable).reason

    given("정률 쿠폰") {
        then("할인 = 내림(대상 금액 × 율) — 12,345원의 10% 는 1,234원") {
            discount(rate(1000, 5_000).evaluate(lines(1L to 12_345L), inPeriod)) shouldBe 1_234L
        }
        then("3.33% 는 10,001원에서 333원 (333.03 내림)") {
            discount(rate(333, 5_000).evaluate(lines(1L to 10_001L), inPeriod)) shouldBe 333L
        }
        then("최대 할인을 넘지 않는다 — 12,345원의 10% 는 최대 1,000원") {
            discount(rate(1000, 1_000).evaluate(lines(1L to 12_345L), inPeriod)) shouldBe 1_000L
        }
        then("여러 라인은 합한 금액에 율을 한 번 적용한다") {
            discount(rate(1000, 5_000).evaluate(lines(1L to 5_005L, 2L to 5_005L), inPeriod)) shouldBe 1_001L
        }
    }

    given("최소 주문 금액 경계") {
        val coupon = fixed(1_000L, minOrder = 10_000L)
        then("대상 금액 9,999원은 미달") {
            reason(coupon.evaluate(lines(1L to 9_999L), inPeriod)) shouldBe PromotionFailureReason.BELOW_MIN_ORDER_AMOUNT
        }
        then("대상 금액 10,000원은 적용") {
            discount(coupon.evaluate(lines(1L to 10_000L), inPeriod)) shouldBe 1_000L
        }
    }

    given("사용 기간 경계 — [시작, 종료)") {
        val coupon = fixed(1_000L)
        then("시작 시각 정각은 적용") {
            discount(coupon.evaluate(lines(1L to 5_000L), from)) shouldBe 1_000L
        }
        then("시작 1ns 전은 기간 밖") {
            reason(coupon.evaluate(lines(1L to 5_000L), from.minusNanos(1))) shouldBe PromotionFailureReason.COUPON_NOT_IN_PERIOD
        }
        then("종료 1ns 전은 적용") {
            discount(coupon.evaluate(lines(1L to 5_000L), until.minusNanos(1))) shouldBe 1_000L
        }
        then("종료 시각 정각은 기간 밖") {
            reason(coupon.evaluate(lines(1L to 5_000L), until)) shouldBe PromotionFailureReason.COUPON_NOT_IN_PERIOD
        }
    }

    given("판매자 부담 쿠폰") {
        val coupon = fixed(3_000L, minOrder = 4_000L, bearer = CouponBearer.SELLER, sellerId = 7L)
        then("그 판매자 라인만 대상 금액이다 — 다른 판매자 라인은 최소 주문 금액에도 안 센다") {
            discount(coupon.evaluate(lines(7L to 5_000L, 8L to 20_000L), inPeriod)) shouldBe 3_000L
            reason(coupon.evaluate(lines(7L to 3_000L, 8L to 20_000L), inPeriod)) shouldBe PromotionFailureReason.BELOW_MIN_ORDER_AMOUNT
        }
        then("그 판매자 라인이 없으면 적용 대상이 아니다") {
            reason(coupon.evaluate(lines(8L to 20_000L), inPeriod)) shouldBe PromotionFailureReason.COUPON_NOT_APPLICABLE
        }
    }

    given("정액 쿠폰") {
        then("할인은 대상 금액을 넘지 않는다") {
            discount(fixed(5_000L).evaluate(lines(1L to 3_000L), inPeriod)) shouldBe 3_000L
        }
    }

    given("정의 생성 검증") {
        then("정률인데 최대 할인이 없으면 거부") {
            shouldThrow<IllegalArgumentException> { rate(1000, 0L) }
        }
        then("판매자 부담인데 판매자 id 가 없으면 거부") {
            shouldThrow<IllegalArgumentException> { fixed(1_000L, bearer = CouponBearer.SELLER, sellerId = null) }
        }
        then("종료가 시작보다 앞서면 거부") {
            shouldThrow<IllegalArgumentException> {
                CouponDefinition.create(
                    name = "x", type = CouponType.FIXED, amount = 1_000L, rateBp = null, maxDiscount = null,
                    minOrderAmount = 0L, validFrom = until, validUntil = from, issueLimit = 1,
                    bearer = CouponBearer.PLATFORM, sellerId = null, createdBy = "1", now = from,
                )
            }
        }
    }
})
