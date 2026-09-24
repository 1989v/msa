package com.kgd.order.domain.order.model

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.exception.InvalidOrderStatusException
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetLine
import com.kgd.order.domain.sheet.model.ShippingLine
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.ZoneOffset

/** 주문 상태 머신 (스펙 SR-2) — 표의 모든 행은 허용, 나머지는 전부 예외 */
class OrderTest : BehaviorSpec({

    val now = Instant.parse("2026-10-10T00:00:00Z")

    fun sheet(couponDiscount: Long = 0, pointAmount: Long = 0, shippingFee: Long = 3_000, unitPrice: Long = 10_000) =
        OrderSheet.create(
            memberId = "m-1",
            lines = listOf(
                OrderSheetLine(1, 101L, "머그", 7L, unitPrice, 2, couponDiscount, CouponBearer.SELLER.takeIf { couponDiscount > 0 }, pointAmount, 1_200),
                OrderSheetLine(2, 102L, "컵", 1L, unitPrice, 1, 0, null, 0, 0),
            ),
            shippingLines = listOf(ShippingLine(7L, shippingFee), ShippingLine(1L, 0L)),
            userCouponId = null,
            couponDefinitionId = null,
            expiresAt = now.plusSeconds(900),
            createdAt = now,
        ).let {
            OrderSheet.restore(
                10L, it.memberId, it.lines, it.shippingLines, it.userCouponId, it.couponDefinitionId, it.status,
                it.usedOrderId, it.expiresAt, it.createdAt,
            )
        }

    fun zeroWonSheet() = sheet(couponDiscount = 0, pointAmount = 0, shippingFee = 0, unitPrice = 0)

    /** [status] 에 도달한 주문 — 허용된 경로로만 간다 */
    fun orderAt(status: OrderStatus, zeroWon: Boolean = false): Order {
        val o = Order.place("m-1", if (zeroWon) zeroWonSheet() else sheet(), now, ZoneOffset.UTC)
        when (status) {
            OrderStatus.CREATED -> Unit
            OrderStatus.PAYMENT_PENDING -> o.awaitPayment(now)
            OrderStatus.PAID -> { o.awaitPayment(now); o.markPaid(now) }
            OrderStatus.CONFIRMED -> { o.awaitPayment(now); o.markPaid(now); o.confirm(now) }
            OrderStatus.FULFILLING -> { o.awaitPayment(now); o.markPaid(now); o.confirm(now); o.startFulfilling(now) }
            OrderStatus.COMPLETED -> {
                o.awaitPayment(now); o.markPaid(now); o.confirm(now); o.startFulfilling(now)
                o.items.forEach { o.confirmLinePurchase(it.lineNo) }
                o.completePurchase(now)
            }
            OrderStatus.CANCELLED -> o.cancelBeforePayment("m-1", now)
            OrderStatus.FAILED -> o.fail(OrderFailureReason.INSUFFICIENT_STOCK, now)
        }
        o.pullStatusChanges()
        return o
    }

    /** 이동 시도 — 도메인 메서드로만. 전 라인 취소·구매 확정 같은 선행 조건은 채워 둔다 */
    fun attempt(o: Order, to: OrderStatus) {
        when (to) {
            OrderStatus.CREATED -> error("CREATED 로 가는 전이는 없다")
            OrderStatus.PAYMENT_PENDING -> o.awaitPayment(now)
            OrderStatus.PAID -> o.markPaid(now)
            OrderStatus.CONFIRMED -> o.confirm(now)
            OrderStatus.FULFILLING -> o.startFulfilling(now)
            OrderStatus.COMPLETED -> {
                o.items.filter { it.status == OrderLineStatus.ACTIVE }.forEach { o.confirmLinePurchase(it.lineNo) }
                o.completePurchase(now)
            }
            OrderStatus.CANCELLED ->
                if (o.status == OrderStatus.CREATED) {
                    o.cancelBeforePayment("m-1", now)
                } else {
                    o.items.filter { it.status == OrderLineStatus.ACTIVE }.forEach { o.cancelLine(it.lineNo) }
                    o.cancelByClaim("m-1", now)
                }
            OrderStatus.FAILED -> o.fail(OrderFailureReason.PAYMENT_DECLINED, now)
        }
    }

    val allowed = setOf(
        OrderStatus.CREATED to OrderStatus.PAYMENT_PENDING,
        OrderStatus.CREATED to OrderStatus.FAILED,
        OrderStatus.PAYMENT_PENDING to OrderStatus.FAILED,
        OrderStatus.PAID to OrderStatus.FAILED,
        OrderStatus.CREATED to OrderStatus.CONFIRMED,
        OrderStatus.CREATED to OrderStatus.CANCELLED,
        OrderStatus.PAYMENT_PENDING to OrderStatus.PAID,
        OrderStatus.PAID to OrderStatus.CONFIRMED,
        OrderStatus.CONFIRMED to OrderStatus.FULFILLING,
        OrderStatus.FULFILLING to OrderStatus.COMPLETED,
        OrderStatus.CONFIRMED to OrderStatus.CANCELLED,
        OrderStatus.FULFILLING to OrderStatus.CANCELLED,
    )

    given("전이표 (8 × 8)") {
        then("표의 행만 canMoveTo 가 참이다") {
            OrderStatus.entries.forEach { from ->
                OrderStatus.entries.forEach { to -> from.canMoveTo(to) shouldBe ((from to to) in allowed) }
            }
        }
        then("도메인 메서드도 표의 행만 통과하고 나머지는 예외 — 통과하면 이력 한 줄") {
            OrderStatus.entries.forEach { from ->
                OrderStatus.entries.filter { it != OrderStatus.CREATED }.forEach { to ->
                    // CREATED → CONFIRMED 는 0원 주문만
                    val o = orderAt(from, zeroWon = from == OrderStatus.CREATED && to == OrderStatus.CONFIRMED)
                    if ((from to to) in allowed) {
                        attempt(o, to)
                        o.status shouldBe to
                        o.pullStatusChanges().single().let { it.from shouldBe from; it.to shouldBe to }
                    } else {
                        shouldThrow<InvalidOrderStatusException> { attempt(o, to) }
                        o.status shouldBe from
                        o.pullStatusChanges().shouldBeEmpty()
                    }
                }
            }
        }
    }

    given("주문 접수") {
        val o = Order.place("m-1", sheet(couponDiscount = 2_000, pointAmount = 1_000), now, ZoneOffset.UTC)
        then("CREATED 이고 이력 (없음 → CREATED) 한 줄, 금액은 주문서 스냅샷 그대로") {
            o.status shouldBe OrderStatus.CREATED
            o.pullStatusChanges().single().let { it.from shouldBe null; it.to shouldBe OrderStatus.CREATED }
            o.itemsAmount shouldBe 30_000L
            o.couponDiscount shouldBe 2_000L
            o.pointAmount shouldBe 1_000L
            o.shippingAmount shouldBe 3_000L
            o.payableAmount shouldBe 30_000L
            o.orderSheetId shouldBe 10L
            o.items.first().let {
                it.sellerCouponAllocation shouldBe 2_000L
                it.platformCouponAllocation shouldBe 0L
                it.netSales shouldBe 18_000L
                it.commission shouldBe 2_160L
                it.payable shouldBe 17_000L
            }
        }
        then("결제액이 있으면 CREATED → CONFIRMED 는 거부된다(0원 경로 전용)") {
            val paid = Order.place("m-1", sheet(), now, ZoneOffset.UTC)
            shouldThrow<InvalidOrderStatusException> { paid.confirm(now) }
        }
    }

    given("라인 상태 · 환불 누계") {
        then("ACTIVE → CANCELLED · ACTIVE → PURCHASE_CONFIRMED 만, 종착에서 다시 바꾸면 예외") {
            val o = orderAt(OrderStatus.FULFILLING)
            o.cancelLine(1)
            o.confirmLinePurchase(2)
            shouldThrow<InvalidOrderStatusException> { o.cancelLine(1) }
            shouldThrow<InvalidOrderStatusException> { o.confirmLinePurchase(1) }
            shouldThrow<InvalidOrderStatusException> { o.cancelLine(2) }
        }
        then("부분 취소된 주문도 남은 라인이 전부 구매 확정되면 COMPLETED") {
            val o = orderAt(OrderStatus.FULFILLING)
            o.cancelLine(1)
            o.confirmLinePurchase(2)
            o.completePurchase(now)
            o.status shouldBe OrderStatus.COMPLETED
        }
        then("ACTIVE 라인이 남으면 COMPLETED 불가 · 전 라인 취소가 아니면 클레임 취소 불가") {
            val o = orderAt(OrderStatus.FULFILLING)
            o.confirmLinePurchase(1)
            shouldThrow<InvalidOrderStatusException> { o.completePurchase(now) }
            val c = orderAt(OrderStatus.CONFIRMED)
            c.cancelLine(1)
            shouldThrow<InvalidOrderStatusException> { c.cancelByClaim("m-1", now) }
        }
        then("환불 누계는 결제액을 넘지 못한다") {
            val o = orderAt(OrderStatus.CONFIRMED)
            o.addRefund(20_000)
            o.refundedAmount shouldBe 20_000L
            shouldThrow<IllegalArgumentException> { o.addRefund(o.payableAmount - 20_000 + 1) }
        }
    }
})
