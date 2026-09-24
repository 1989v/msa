package com.kgd.order.domain.sheet.model

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.sheet.exception.OrderSheetUnavailableException
import java.time.Instant

enum class OrderSheetStatus { ACTIVE, USED }

/**
 * 주문서 라인 스냅샷 — 만들 때의 상품명·판매가·수량·쿠폰/포인트 안분·쿠폰 부담 주체·수수료율·판매자.
 * 뒤에 상품 가격이나 판매자 수수료율이 바뀌어도 이 값은 그대로다.
 */
data class OrderSheetLine(
    val lineNo: Int,
    val productId: Long,
    val productName: String,
    val sellerId: Long,
    val unitPrice: Long,
    val quantity: Int,
    val couponDiscount: Long,
    /** 이 라인에 쿠폰 할인이 안분됐을 때의 부담 주체 */
    val couponBearer: CouponBearer?,
    val pointAmount: Long,
    val commissionRateBp: Int,
) {
    init {
        require(quantity > 0) { "수량은 1 이상" }
        require(couponDiscount >= 0 && pointAmount >= 0) { "할인·포인트는 음수일 수 없다" }
        require(payable >= 0) { "라인 결제액이 음수다: line=$lineNo" }
    }

    /** 판매가 × 수량 */
    val amount: Long get() = Math.multiplyExact(unitPrice, quantity.toLong())

    /** 라인 결제액 — 부분 취소 환불액이 된다 */
    val payable: Long get() = amount - couponDiscount - pointAmount

    /** 판매자 순매출 = 판매가 × 수량 − 판매자 부담 쿠폰. 플랫폼 할인·포인트는 판매자 매출을 줄이지 않는다 */
    val netSales: Long get() = amount - if (couponBearer == CouponBearer.SELLER) couponDiscount else 0L

    val commission: Long get() = Commission.of(netSales, commissionRateBp)
}

/** 판매자별 배송비 라인 — 한 주문서에서 판매자마다 한 번 */
data class ShippingLine(val sellerId: Long, val fee: Long) {
    init {
        require(fee >= 0) { "배송비는 음수일 수 없다" }
    }
}

/**
 * 주문서 — 서버가 읽기 모델로 계산한 금액·혜택 견적 스냅샷. 만료가 있고 주문 하나에 한 번만 쓴다.
 * 할인·잔액은 견적이다. 최종 판정은 사가의 promotion reserve 가 한다.
 */
class OrderSheet private constructor(
    val id: Long?,
    val memberId: String,
    val lines: List<OrderSheetLine>,
    val shippingLines: List<ShippingLine>,
    val userCouponId: Long?,
    val couponDefinitionId: Long?,
    status: OrderSheetStatus,
    usedOrderId: Long?,
    val expiresAt: Instant,
    val createdAt: Instant,
) {
    var status: OrderSheetStatus = status
        private set
    var usedOrderId: Long? = usedOrderId
        private set

    val itemsAmount: Long get() = lines.fold(0L) { acc, l -> Math.addExact(acc, l.amount) }
    val couponDiscount: Long get() = lines.sumOf { it.couponDiscount }
    val pointAmount: Long get() = lines.sumOf { it.pointAmount }
    val shippingAmount: Long get() = shippingLines.sumOf { it.fee }

    /** 결제액 = 상품 − 쿠폰 − 포인트 + 배송비 */
    val payableAmount: Long get() = itemsAmount - couponDiscount - pointAmount + shippingAmount

    /** 소유자부터 본다 — 남에게는 만료·사용 여부도 알려주지 않는다 */
    fun checkUsableBy(memberId: String, now: Instant) {
        if (memberId != this.memberId) throw OrderSheetUnavailableException(OrderSheetRejection.NOT_OWNER)
        if (status == OrderSheetStatus.USED) throw OrderSheetUnavailableException(OrderSheetRejection.ALREADY_USED)
        if (!now.isBefore(expiresAt)) throw OrderSheetUnavailableException(OrderSheetRejection.EXPIRED)
    }

    /** 주문 접수 — 주문서 1개 = 주문 1개 */
    fun markUsed(orderId: Long, memberId: String, now: Instant) {
        checkUsableBy(memberId, now)
        status = OrderSheetStatus.USED
        usedOrderId = orderId
    }

    companion object {
        fun create(
            memberId: String,
            lines: List<OrderSheetLine>,
            shippingLines: List<ShippingLine>,
            userCouponId: Long?,
            couponDefinitionId: Long?,
            expiresAt: Instant,
            createdAt: Instant,
        ): OrderSheet {
            require(memberId.isNotBlank()) { "회원 id 가 비었다" }
            require(lines.isNotEmpty()) { "주문서 라인이 없다" }
            require(expiresAt.isAfter(createdAt)) { "만료가 생성보다 늦어야 한다" }
            return OrderSheet(
                null, memberId, lines, shippingLines, userCouponId, couponDefinitionId,
                OrderSheetStatus.ACTIVE, null, expiresAt, createdAt,
            )
        }

        fun restore(
            id: Long,
            memberId: String,
            lines: List<OrderSheetLine>,
            shippingLines: List<ShippingLine>,
            userCouponId: Long?,
            couponDefinitionId: Long?,
            status: OrderSheetStatus,
            usedOrderId: Long?,
            expiresAt: Instant,
            createdAt: Instant,
        ) = OrderSheet(
            id, memberId, lines, shippingLines, userCouponId, couponDefinitionId, status, usedOrderId, expiresAt, createdAt,
        )
    }
}
