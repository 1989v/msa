package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.sheet.model.ShippingLine
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.Instant
import java.time.LocalDateTime

/**
 * `order.order.confirmed` 페이로드 — settlement 가 이것만으로 매입 분개를 만든다(스펙 SR-9).
 * 판정은 아웃박스에 남은 JSON 의 값이다.
 */
class OrderOutboxEventAdapterTest : BehaviorSpec({

    data class Row(val eventType: String, val payload: String, val partitionKey: String?)

    val rows = mutableListOf<Row>()
    val outbox = object : OutboxPort {
        override fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String, partitionKey: String?, headers: Map<String, String>) {
            rows += Row(eventType, payload, partitionKey)
        }
    }
    val mapper = jacksonObjectMapper()

    fun line(id: Long, lineNo: Int, sellerId: Long, price: Long, qty: Int, coupon: Long, bearer: CouponBearer?, point: Long, bp: Int) =
        OrderItem.restore(id, lineNo, 100L + lineNo, "상품$lineNo", sellerId, Money(price), qty, coupon, bearer, point, bp, OrderLineStatus.ACTIVE)

    given("판매자 쿠폰 · 플랫폼 쿠폰 · 포인트가 섞인 2판매자 주문") {
        val order = Order.restore(
            id = 77L, userId = "m-1", orderSheetId = 5L, userCouponId = null,
            items = listOf(
                line(701L, 1, 7L, 10_000, 2, 2_000, CouponBearer.SELLER, 1_000, 1_250),
                line(702L, 2, 8L, 5_000, 1, 500, CouponBearer.PLATFORM, 0, 1_000),
            ),
            shippingLines = listOf(ShippingLine(7L, 3_000), ShippingLine(8L, 2_500)),
            status = OrderStatus.CONFIRMED, failureReason = null, refundedAmount = 0, createdAt = LocalDateTime.now(), version = 3,
        )
        OrderOutboxEventAdapter(outbox, mapper).publishConfirmed(order, Instant.parse("2026-10-10T00:00:00Z"))

        then("토픽 order.order.confirmed, 키 orderId") {
            rows.single().eventType shouldBe "order.order.confirmed"
            rows.single().partitionKey shouldBe "77"
        }
        then("라인마다 판매자·안분·수수료율·순매출·수수료·결제액, 판매자별 배송비 라인") {
            val node = mapper.readTree(rows.single().payload)
            val l1 = node.get("lines").get(0)
            l1.get("orderItemId").asLong() shouldBe 701L
            l1.get("sellerId").asLong() shouldBe 7L
            l1.get("productId").asLong() shouldBe 101L
            l1.get("quantity").asInt() shouldBe 2
            l1.get("unitPrice").asLong() shouldBe 10_000L
            l1.get("sellerCouponAllocation").asLong() shouldBe 2_000L
            l1.get("platformCouponAllocation").asLong() shouldBe 0L
            l1.get("pointAllocation").asLong() shouldBe 1_000L
            l1.get("commissionRateBp").asInt() shouldBe 1_250
            l1.get("netSales").asLong() shouldBe 18_000L
            l1.get("commission").asLong() shouldBe 2_250L
            l1.get("payable").asLong() shouldBe 17_000L
            val l2 = node.get("lines").get(1)
            l2.get("sellerCouponAllocation").asLong() shouldBe 0L
            l2.get("platformCouponAllocation").asLong() shouldBe 500L
            l2.get("netSales").asLong() shouldBe 5_000L
            l2.get("commission").asLong() shouldBe 500L
            node.get("shippingLines").get(1).get("sellerId").asLong() shouldBe 8L
            node.get("shippingLines").get(1).get("fee").asLong() shouldBe 2_500L
        }
        then("검산: 결제액 = Σ순매출 + Σ배송비 − Σ플랫폼 쿠폰 − Σ포인트") {
            val node = mapper.readTree(rows.single().payload)
            val lines = (0 until node.get("lines").size()).map { node.get("lines").get(it) }
            val n = lines.sumOf { it.get("netSales").asLong() }
            val s = (0 until node.get("shippingLines").size()).sumOf { node.get("shippingLines").get(it).get("fee").asLong() }
            val dp = lines.sumOf { it.get("platformCouponAllocation").asLong() }
            val p = lines.sumOf { it.get("pointAllocation").asLong() }
            node.get("payableAmount").asLong() shouldBe n + s - dp - p
        }
    }
})
