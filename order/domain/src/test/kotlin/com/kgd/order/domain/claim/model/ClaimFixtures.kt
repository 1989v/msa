package com.kgd.order.domain.claim.model

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetLine
import com.kgd.order.domain.sheet.model.OrderSheetStatus
import com.kgd.order.domain.sheet.model.ShippingLine
import java.time.Instant
import java.time.ZoneOffset

/**
 * 판매자 둘 · 라인 셋 · 쿠폰 · 포인트 주문.
 *
 * | 라인 | 판매자 | 판매가×수량 | 쿠폰(부담) | 포인트 | 라인 결제액 |
 * |---|---|---|---|---|---|
 * | 1 | 7 | 10,000×2 | 2,000 (PLATFORM) | 1,000 | 17,000 |
 * | 2 | 7 | 5,000×1 | 0 | 500 | 4,500 |
 * | 3 | 8 | 8,000×1 | 1,000 (SELLER) | 0 | 7,000 |
 *
 * 배송비 판매자 7 = 3,000 · 판매자 8 = 2,500. 결제액 = 28,500 + 5,500 = 34,000.
 */
object ClaimFixtures {
    val NOW: Instant = Instant.parse("2026-10-10T00:00:00Z")

    fun fulfillingOrder(pointOnly: Boolean = false): Order {
        val lines = if (pointOnly) {
            listOf(OrderSheetLine(1, 101L, "머그", 7L, 10_000, 1, 0, null, 10_000, 1_000))
        } else {
            listOf(
                OrderSheetLine(1, 101L, "머그", 7L, 10_000, 2, 2_000, CouponBearer.PLATFORM, 1_000, 1_000),
                OrderSheetLine(2, 102L, "받침", 7L, 5_000, 1, 0, null, 500, 1_000),
                OrderSheetLine(3, 103L, "찻잔", 8L, 8_000, 1, 1_000, CouponBearer.SELLER, 0, 500),
            )
        }
        val shipping = if (pointOnly) listOf(ShippingLine(7L, 0)) else listOf(ShippingLine(7L, 3_000), ShippingLine(8L, 2_500))
        val sheet = OrderSheet.restore(
            50L, "m-1", lines, shipping, if (pointOnly) null else 900L, null, OrderSheetStatus.ACTIVE, null,
            NOW.plusSeconds(900), NOW,
        )
        val placed = Order.place("m-1", sheet, NOW, ZoneOffset.UTC)
        val order = Order.restore(
            1L, placed.userId, placed.orderSheetId, placed.userCouponId, placed.items, placed.shippingLines, placed.status,
            null, 0L, placed.createdAt, 0L,
        )
        if (!pointOnly) order.awaitPayment(NOW).also { order.markPaid(NOW) }
        order.confirm(NOW)
        order.startFulfilling(NOW)
        order.pullStatusChanges()
        return order
    }
}
