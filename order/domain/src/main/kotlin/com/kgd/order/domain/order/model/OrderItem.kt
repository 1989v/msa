package com.kgd.order.domain.order.model

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.exception.InvalidOrderStatusException
import com.kgd.order.domain.sheet.model.Commission
import com.kgd.order.domain.sheet.model.OrderSheetLine
import java.time.Instant

/**
 * 주문 라인 — 주문서 라인 스냅샷(상품명·판매가·수량·쿠폰/포인트 안분·쿠폰 부담 주체·수수료율·판매자)을 그대로 옮긴다.
 * 금액은 만든 뒤 바뀌지 않고 상태만 ACTIVE → CANCELLED · ACTIVE → PURCHASE_CONFIRMED 로 바뀐다.
 * 출고·배송 완료·구매 확정 시각은 표시다 — 상태를 바꾸지 않고, 자동 구매 확정이 배송 완료 시각을 본다.
 */
class OrderItem private constructor(
    val id: Long?,
    val lineNo: Int,
    val productId: Long,
    val productName: String,
    val sellerId: Long,
    val unitPrice: Money,
    val quantity: Int,
    val couponDiscount: Long,
    val couponBearer: CouponBearer?,
    val pointAmount: Long,
    val commissionRateBp: Int,
    status: OrderLineStatus,
    shippedAt: Instant?,
    deliveredAt: Instant?,
    purchaseConfirmedAt: Instant?,
) {
    init {
        require(quantity > 0) { "수량은 0보다 커야 합니다" }
        require(couponDiscount >= 0 && pointAmount >= 0) { "할인·포인트는 음수일 수 없다" }
        require(payable >= 0) { "라인 결제액이 음수다: line=$lineNo" }
    }

    var status: OrderLineStatus = status
        private set
    var shippedAt: Instant? = shippedAt
        private set
    var deliveredAt: Instant? = deliveredAt
        private set
    var purchaseConfirmedAt: Instant? = purchaseConfirmedAt
        private set

    /** 판매가 × 수량 */
    val amount: Long get() = (unitPrice * quantity).amount

    /** 라인 결제액 = 판매가 × 수량 − 쿠폰 안분 − 포인트 안분. 부분 취소 환불액이 된다 */
    val payable: Long get() = amount - couponDiscount - pointAmount

    val sellerCouponAllocation: Long get() = if (couponBearer == CouponBearer.SELLER) couponDiscount else 0L
    val platformCouponAllocation: Long get() = couponDiscount - sellerCouponAllocation

    /** 판매자 순매출 = 판매가 × 수량 − 판매자 부담 쿠폰 */
    val netSales: Long get() = amount - sellerCouponAllocation

    val commission: Long get() = Commission.of(netSales, commissionRateBp)

    internal fun cancel() = moveTo(OrderLineStatus.CANCELLED)

    internal fun confirmPurchase(at: Instant? = null) {
        moveTo(OrderLineStatus.PURCHASE_CONFIRMED)
        purchaseConfirmedAt = at
    }

    /** 먼저 온 시각을 남긴다 — 재배달된 출고 이벤트가 시각을 늦추지 않는다 */
    internal fun markShipped(at: Instant) {
        if (shippedAt == null) shippedAt = at
    }

    /** 배송 완료는 출고를 포함한다 — 출고 이벤트를 놓쳐도 출고 표시가 남는다 */
    internal fun markDelivered(at: Instant) {
        markShipped(at)
        if (deliveredAt == null) deliveredAt = at
    }

    private fun moveTo(next: OrderLineStatus) {
        if (status != OrderLineStatus.ACTIVE) throw InvalidOrderStatusException("라인 $lineNo: $status → $next")
        status = next
    }

    companion object {
        fun fromSheet(line: OrderSheetLine): OrderItem = OrderItem(
            id = null, lineNo = line.lineNo, productId = line.productId, productName = line.productName,
            sellerId = line.sellerId, unitPrice = Money(line.unitPrice), quantity = line.quantity,
            couponDiscount = line.couponDiscount, couponBearer = line.couponBearer, pointAmount = line.pointAmount,
            commissionRateBp = line.commissionRateBp, status = OrderLineStatus.ACTIVE,
            shippedAt = null, deliveredAt = null, purchaseConfirmedAt = null,
        )

        fun restore(
            id: Long?,
            lineNo: Int,
            productId: Long,
            productName: String,
            sellerId: Long,
            unitPrice: Money,
            quantity: Int,
            couponDiscount: Long,
            couponBearer: CouponBearer?,
            pointAmount: Long,
            commissionRateBp: Int,
            status: OrderLineStatus,
            shippedAt: Instant? = null,
            deliveredAt: Instant? = null,
            purchaseConfirmedAt: Instant? = null,
        ) = OrderItem(
            id, lineNo, productId, productName, sellerId, unitPrice, quantity, couponDiscount, couponBearer,
            pointAmount, commissionRateBp, status, shippedAt, deliveredAt, purchaseConfirmedAt,
        )
    }
}
