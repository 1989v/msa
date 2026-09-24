package com.kgd.order.support

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetLine
import com.kgd.order.domain.sheet.model.OrderSheetStatus
import com.kgd.order.domain.sheet.model.ShippingLine
import java.time.Instant
import java.time.ZoneOffset

/**
 * 클레임·구매 확정 테스트 주문 — 판매자 7(라인 1·2) · 판매자 8(라인 3), 쿠폰 900 · 포인트.
 *
 * | 라인 | 상품 | 판매자 | 판매가×수량 | 쿠폰 | 포인트 | 결제액 |
 * |---|---|---|---|---|---|---|
 * | 1 | 101 | 7 | 10,000×2 | 2,000 | 1,000 | 17,000 |
 * | 2 | 102 | 7 | 5,000×1 | 0 | 500 | 4,500 |
 * | 3 | 103 | 8 | 8,000×1 | 1,000 | 0 | 7,000 |
 *
 * 배송비 7 = 3,000 · 8 = 2,500 → 결제액 34,000.
 */
object ClaimTestOrders {
    /** [world] 에 저장하고 [fulfilling] 이면 FULFILLING, 아니면 CONFIRMED 까지 옮긴다. 주문 id */
    fun place(world: InMemorySagaWorld, now: Instant, fulfilling: Boolean = true, buyer: String = "m-1"): Long {
        val sheet = OrderSheet.restore(
            50L, buyer,
            listOf(
                OrderSheetLine(1, 101L, "머그", 7L, 10_000, 2, 2_000, CouponBearer.PLATFORM, 1_000, 1_000),
                OrderSheetLine(2, 102L, "받침", 7L, 5_000, 1, 0, null, 500, 1_000),
                OrderSheetLine(3, 103L, "찻잔", 8L, 8_000, 1, 1_000, CouponBearer.SELLER, 0, 500),
            ),
            listOf(ShippingLine(7L, 3_000), ShippingLine(8L, 2_500)), 900L, null, OrderSheetStatus.ACTIVE, null,
            now.plusSeconds(900), now,
        )
        val order = world.orders.save(Order.place(buyer, sheet, now, ZoneOffset.UTC))
        order.awaitPayment(now)
        order.markPaid(now)
        order.confirm(now)
        if (fulfilling) order.startFulfilling(now)
        return requireNotNull(world.orders.save(order).id)
    }
}
