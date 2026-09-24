package com.kgd.order.domain.order.model

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.exception.InvalidOrderStatusException
import com.kgd.order.domain.sheet.model.Commission
import com.kgd.order.domain.sheet.model.OrderSheetLine

/**
 * 주문 라인 — 주문서 라인 스냅샷(상품명·판매가·수량·쿠폰/포인트 안분·쿠폰 부담 주체·수수료율·판매자)을 그대로 옮긴다.
 * 금액은 만든 뒤 바뀌지 않고 상태만 ACTIVE → CANCELLED · ACTIVE → PURCHASE_CONFIRMED 로 바뀐다.
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
) {
    init {
        require(quantity > 0) { "수량은 0보다 커야 합니다" }
        require(couponDiscount >= 0 && pointAmount >= 0) { "할인·포인트는 음수일 수 없다" }
        require(payable >= 0) { "라인 결제액이 음수다: line=$lineNo" }
    }

    var status: OrderLineStatus = status
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

    internal fun confirmPurchase() = moveTo(OrderLineStatus.PURCHASE_CONFIRMED)

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
        ) = OrderItem(
            id, lineNo, productId, productName, sellerId, unitPrice, quantity, couponDiscount, couponBearer,
            pointAmount, commissionRateBp, status,
        )
    }
}
