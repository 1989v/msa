package com.kgd.order.domain.sheet.model

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.CouponType
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import com.kgd.order.domain.sheet.exception.OrderSheetUnavailableException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

/**
 * 주문서 계산 — 판매 가능 판정, 쿠폰·포인트 안분, 판매자별 배송비, 수수료율 스냅샷, 합계.
 * 그리고 주문서 사용 가드(만료·재사용·타인).
 */
class OrderSheetTest : BehaviorSpec({

    val now = Instant.parse("2026-10-10T00:00:00Z")
    val ttl = Duration.ofMinutes(15)
    val old = Instant.parse("2026-01-01T00:00:00Z")

    val platform = SellerView(1L, "ACTIVE", 0, 0L, old)
    val shopA = SellerView(7L, "ACTIVE", 1_200, 3_000L, old)
    val suspended = SellerView(8L, "SUSPENDED", 1_000, 2_500L, old)
    val sellers = listOf(platform, shopA, suspended).associateBy { it.sellerId }

    val p1 = ProductView(101L, "머그", 12_000L, "ACTIVE", 7L, old)
    val p2 = ProductView(102L, "컵받침", 3_000L, "ACTIVE", 7L, old)
    val p3 = ProductView(103L, "플랫폼 상품", 20_000L, "ACTIVE", 1L, old)
    val pSuspended = ProductView(104L, "정지 판매자 상품", 5_000L, "ACTIVE", 8L, old)
    val pInactive = ProductView(105L, "판매 중지", 5_000L, "INACTIVE", 1L, old)
    val products = listOf(p1, p2, p3, pSuspended, pInactive).associateBy { it.productId }

    fun item(productId: Long, qty: Int) = OrderSheetPricing.Item(productId, qty)

    fun price(
        items: List<OrderSheetPricing.Item>,
        coupon: OrderSheetPricing.CouponChoice? = null,
        points: Long = 0L,
        balance: Long = 0L,
    ) = OrderSheetPricing.price(
        memberId = "m-1", items = items, products = products, sellers = sellers,
        coupon = coupon, pointAmount = points, pointBalance = balance, now = now, ttl = ttl,
    )

    fun rejection(block: () -> Unit): OrderSheetRejection = shouldThrow<OrderSheetUnavailableException>(block).rejection

    given("판매 가능 판정") {
        then("정지된 판매자의 상품은 거부 — SELLER_UNAVAILABLE") {
            rejection { price(listOf(item(101L, 1), item(104L, 1))) } shouldBe OrderSheetRejection.SELLER_UNAVAILABLE
        }
        then("판매 중지 상품은 거부 — PRODUCT_UNAVAILABLE") {
            rejection { price(listOf(item(105L, 1))) } shouldBe OrderSheetRejection.PRODUCT_UNAVAILABLE
        }
        then("읽기 모델에 없는 상품도 거부") {
            rejection { price(listOf(item(999L, 1))) } shouldBe OrderSheetRejection.PRODUCT_UNAVAILABLE
        }
    }

    given("같은 상품이 요청에 두 번 온다") {
        val sheet = price(listOf(item(101L, 1), item(103L, 1), item(101L, 2)))
        then("처음 나온 자리에서 수량을 합쳐 한 라인 — 라인 번호는 1부터 이어진다") {
            sheet.lines.map { Triple(it.lineNo, it.productId, it.quantity) } shouldBe listOf(Triple(1, 101L, 3), Triple(2, 103L, 1))
            sheet.lines.first().amount shouldBe 36_000L
        }
    }

    given("쿠폰·포인트 없는 두 판매자 주문") {
        val sheet = price(listOf(item(101L, 2), item(102L, 1), item(103L, 1)))
        then("라인 금액은 읽기 모델 가격 × 수량") {
            sheet.lines.map { it.amount } shouldBe listOf(24_000L, 3_000L, 20_000L)
        }
        then("배송비는 판매자마다 한 번") {
            sheet.shippingLines.map { it.sellerId to it.fee } shouldBe listOf(7L to 3_000L, 1L to 0L)
        }
        then("수수료율은 라인마다 그 판매자 요율로 스냅샷") {
            sheet.lines.map { it.commissionRateBp } shouldBe listOf(1_200, 1_200, 0)
        }
        then("합계 = 상품 47,000 + 배송비 3,000") {
            sheet.itemsAmount shouldBe 47_000L
            sheet.shippingAmount shouldBe 3_000L
            sheet.payableAmount shouldBe 50_000L
        }
        then("상태 ACTIVE, 만료 15분 뒤, 소유자") {
            sheet.status shouldBe OrderSheetStatus.ACTIVE
            sheet.expiresAt shouldBe now.plus(ttl)
            sheet.memberId shouldBe "m-1"
        }
    }

    given("판매자 쿠폰 + 포인트") {
        val definition = CouponDefinitionView(
            couponDefinitionId = 50L, type = CouponType.RATE, amount = null, rateBp = 1_000, maxDiscount = 10_000L,
            minOrderAmount = 10_000L, validFrom = old, validUntil = now.plusSeconds(3600), bearer = CouponBearer.SELLER,
            sellerId = 7L, status = "ACTIVE", occurredAt = old,
        )
        val choice = OrderSheetPricing.CouponChoice(
            userCouponId = 900L,
            userCoupon = UserCouponView(900L, "m-1", 50L, "AVAILABLE", old),
            definition = definition,
        )
        val sheet = price(listOf(item(101L, 2), item(102L, 1), item(103L, 1)), choice, points = 1_000L, balance = 5_000L)

        then("쿠폰 할인 = 판매자 7 라인 합 27,000 × 10% = 2,700, 판매자 7 라인에만 안분") {
            sheet.couponDiscount shouldBe 2_700L
            sheet.lines.map { it.couponDiscount } shouldBe listOf(2_400L, 300L, 0L)
            sheet.lines.map { it.couponBearer } shouldBe listOf(CouponBearer.SELLER, CouponBearer.SELLER, null)
        }
        then("포인트는 쿠폰 뒤 금액(21,600 · 2,700 · 20,000) 비율로 내림 487 · 60 · 451, 잔차 2원은 가장 큰 라인") {
            sheet.lines.map { it.pointAmount } shouldBe listOf(489L, 60L, 451L)
            sheet.lines.sumOf { it.pointAmount } shouldBe 1_000L
        }
        then("라인 결제액 = 금액 − 쿠폰 − 포인트, 주문 결제액 = Σ라인 + 배송비") {
            sheet.lines.map { it.payable } shouldBe listOf(21_111L, 2_640L, 19_549L)
            sheet.payableAmount shouldBe 47_000L - 2_700L - 1_000L + 3_000L
        }
        then("판매자 부담 쿠폰은 순매출을 줄이고 수수료는 순매출 기준") {
            sheet.lines[0].netSales shouldBe 21_600L
            sheet.lines[0].commission shouldBe 2_592L
        }
    }

    given("쿠폰 사용 불가") {
        val definition = CouponDefinitionView(
            50L, CouponType.FIXED, 1_000L, null, null, 0L, old, now.plusSeconds(3600), CouponBearer.PLATFORM, null, "ACTIVE", old,
        )
        then("남의 쿠폰은 없는 쿠폰과 같게 거부") {
            val choice = OrderSheetPricing.CouponChoice(900L, UserCouponView(900L, "m-2", 50L, "AVAILABLE", old), definition)
            rejection { price(listOf(item(103L, 1)), choice) } shouldBe OrderSheetRejection.COUPON_NOT_FOUND
        }
        then("이미 보류·사용된 쿠폰은 COUPON_NOT_USABLE") {
            val choice = OrderSheetPricing.CouponChoice(900L, UserCouponView(900L, "m-1", 50L, "RESERVED", old), definition)
            rejection { price(listOf(item(103L, 1)), choice) } shouldBe OrderSheetRejection.COUPON_NOT_USABLE
        }
    }

    given("포인트 상한") {
        then("잔액보다 많이 쓰면 거부") {
            rejection { price(listOf(item(103L, 1)), points = 5_001L, balance = 5_000L) } shouldBe OrderSheetRejection.POINT_EXCEEDS_BALANCE
        }
        then("상품 결제 대상 금액보다 많이 쓰면 거부 — 배송비는 포인트로 덮지 않는다") {
            rejection { price(listOf(item(101L, 1)), points = 12_001L, balance = 50_000L) } shouldBe OrderSheetRejection.POINT_EXCEEDS_PAYABLE
        }
        then("상품 금액 전부를 포인트로 쓰면 배송비만 남는다") {
            price(listOf(item(101L, 1)), points = 12_000L, balance = 50_000L).payableAmount shouldBe 3_000L
        }
    }

    given("주문서 사용 가드") {
        val sheet = price(listOf(item(103L, 1)))
        then("소유자·기한 안·미사용이면 통과") { sheet.checkUsableBy("m-1", now.plus(ttl).minusMillis(1)) }
        then("타인 → NOT_OWNER") {
            rejection { sheet.checkUsableBy("m-2", now) } shouldBe OrderSheetRejection.NOT_OWNER
        }
        then("만료 시각 정각부터 → EXPIRED") {
            rejection { sheet.checkUsableBy("m-1", now.plus(ttl)) } shouldBe OrderSheetRejection.EXPIRED
        }
        then("한 번 쓰면 → ALREADY_USED") {
            val used = price(listOf(item(103L, 1)))
            used.markUsed(orderId = 77L, memberId = "m-1", now = now)
            used.status shouldBe OrderSheetStatus.USED
            used.usedOrderId shouldBe 77L
            rejection { used.markUsed(orderId = 78L, memberId = "m-1", now = now) } shouldBe OrderSheetRejection.ALREADY_USED
        }
    }
})
