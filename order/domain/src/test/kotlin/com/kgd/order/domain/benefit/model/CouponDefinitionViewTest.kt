package com.kgd.order.domain.benefit.model

import com.kgd.order.domain.sheet.model.OrderSheetRejection
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

/**
 * 주문서 쿠폰 견적 — promotion 의 보류 판정과 같은 규칙이어야 한다(다르면 reserve 가 DISCOUNT_MISMATCH).
 * 정률 내림 · 최대 할인 · 최소 주문 금액 · 기간 [from, until) · 판매자 쿠폰은 그 판매자 라인만.
 */
class CouponDefinitionViewTest : BehaviorSpec({

    val from = Instant.parse("2026-10-01T00:00:00Z")
    val until = Instant.parse("2026-10-31T00:00:00Z")
    val inPeriod = Instant.parse("2026-10-10T00:00:00Z")

    fun coupon(
        type: CouponType,
        amount: Long? = null,
        rateBp: Int? = null,
        maxDiscount: Long? = null,
        minOrder: Long = 0L,
        bearer: CouponBearer = CouponBearer.PLATFORM,
        sellerId: Long? = null,
        status: String = "ACTIVE",
    ) = CouponDefinitionView(
        couponDefinitionId = 1L, type = type, amount = amount, rateBp = rateBp, maxDiscount = maxDiscount,
        minOrderAmount = minOrder, validFrom = from, validUntil = until, bearer = bearer, sellerId = sellerId,
        status = status, occurredAt = from,
    )

    fun lines(vararg l: Pair<Long, Long>) = l.map { (seller, amount) -> CouponTargetLine(seller, amount) }
    fun discount(q: CouponQuote) = (q as CouponQuote.Applicable).discount
    fun reason(q: CouponQuote) = (q as CouponQuote.NotApplicable).reason

    given("정률") {
        then("내림 — 12,345원의 10% 는 1,234원") {
            discount(coupon(CouponType.RATE, rateBp = 1_000, maxDiscount = 5_000).quote(lines(1L to 12_345L), inPeriod)) shouldBe 1_234L
        }
        then("최대 할인에서 멈춘다 — 100,000원의 10% 는 5,000원 상한") {
            discount(coupon(CouponType.RATE, rateBp = 1_000, maxDiscount = 5_000).quote(lines(1L to 100_000L), inPeriod)) shouldBe 5_000L
        }
    }

    given("정액") {
        then("대상 금액을 넘지 않는다") {
            discount(coupon(CouponType.FIXED, amount = 5_000).quote(lines(1L to 3_000L), inPeriod)) shouldBe 3_000L
        }
    }

    given("최소 주문 금액") {
        val c = coupon(CouponType.FIXED, amount = 1_000, minOrder = 10_000)
        then("딱 그 금액이면 적용") { discount(c.quote(lines(1L to 10_000L), inPeriod)) shouldBe 1_000L }
        then("1원 모자라면 BELOW_MIN_ORDER_AMOUNT") {
            reason(c.quote(lines(1L to 9_999L), inPeriod)) shouldBe OrderSheetRejection.BELOW_MIN_ORDER_AMOUNT
        }
    }

    given("사용 기간 [from, until)") {
        val c = coupon(CouponType.FIXED, amount = 1_000)
        then("시작 정각은 포함") { discount(c.quote(lines(1L to 5_000L), from)) shouldBe 1_000L }
        then("시작 1ms 전은 기간 밖") {
            reason(c.quote(lines(1L to 5_000L), from.minusMillis(1))) shouldBe OrderSheetRejection.COUPON_NOT_IN_PERIOD
        }
        then("종료 정각은 제외") {
            reason(c.quote(lines(1L to 5_000L), until)) shouldBe OrderSheetRejection.COUPON_NOT_IN_PERIOD
        }
        then("종료 1ms 전은 포함") { discount(c.quote(lines(1L to 5_000L), until.minusMillis(1))) shouldBe 1_000L }
    }

    given("판매자 쿠폰") {
        val c = coupon(CouponType.RATE, rateBp = 1_000, maxDiscount = 50_000, minOrder = 10_000, bearer = CouponBearer.SELLER, sellerId = 7L)
        then("그 판매자 라인만 대상 — 다른 판매자 라인은 할인 기준에도 최소 금액에도 안 들어간다") {
            val q = c.quote(lines(7L to 12_000L, 8L to 90_000L), inPeriod) as CouponQuote.Applicable
            q.discount shouldBe 1_200L
            q.targetIndexes shouldBe listOf(0)
        }
        then("다른 판매자 라인이 커도 그 판매자 라인이 최소 금액 미만이면 거부") {
            reason(c.quote(lines(7L to 9_000L, 8L to 90_000L), inPeriod)) shouldBe OrderSheetRejection.BELOW_MIN_ORDER_AMOUNT
        }
        then("그 판매자 라인이 없으면 COUPON_NOT_APPLICABLE") {
            reason(c.quote(lines(8L to 90_000L), inPeriod)) shouldBe OrderSheetRejection.COUPON_NOT_APPLICABLE
        }
    }

    given("비활성 정의") {
        then("COUPON_INACTIVE") {
            reason(coupon(CouponType.FIXED, amount = 1_000, status = "INACTIVE").quote(lines(1L to 5_000L), inPeriod)) shouldBe
                OrderSheetRejection.COUPON_INACTIVE
        }
    }
})
