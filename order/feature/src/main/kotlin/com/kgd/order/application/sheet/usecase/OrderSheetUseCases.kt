package com.kgd.order.application.sheet.usecase

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetStatus
import java.time.Instant

/**
 * 주문서 만들기 — 가격·판매 가능·쿠폰·포인트·배송비를 order 읽기 모델로 계산해 스냅샷한다.
 * 명령에 가격 필드가 없다: 금액은 서버만 정한다.
 */
interface CreateOrderSheetUseCase {
    fun execute(command: Command): OrderSheetResult

    /** [items] 와 [fromCart] 중 정확히 하나 */
    data class Command(
        val memberId: String,
        val items: List<Item>?,
        val fromCart: Boolean,
        val userCouponId: Long?,
        val pointAmount: Long,
    ) {
        init {
            require(memberId.isNotBlank()) { "회원 id 가 비었다" }
            require((items != null) != fromCart) { "items 와 fromCart 중 하나만 준다" }
            require(pointAmount >= 0) { "포인트는 음수일 수 없다" }
        }
    }

    data class Item(val productId: Long, val quantity: Int)
}

/** 주문서 조회 — 본인 것만. 남의 주문서는 없는 주문서와 같은 404 */
interface GetOrderSheetUseCase {
    fun execute(memberId: String, orderSheetId: Long): OrderSheetResult
}

data class OrderSheetResult(
    val id: Long,
    val memberId: String,
    val status: OrderSheetStatus,
    val userCouponId: Long?,
    val couponDefinitionId: Long?,
    val itemsAmount: Long,
    val couponDiscount: Long,
    val pointAmount: Long,
    val shippingAmount: Long,
    val payableAmount: Long,
    val expiresAt: Instant,
    val createdAt: Instant,
    val lines: List<Line>,
    val shippingLines: List<Shipping>,
) {
    data class Line(
        val lineNo: Int,
        val productId: Long,
        val productName: String,
        val sellerId: Long,
        val unitPrice: Long,
        val quantity: Int,
        val amount: Long,
        val couponDiscount: Long,
        val couponBearer: CouponBearer?,
        val pointAmount: Long,
        val commissionRateBp: Int,
        val payable: Long,
    )

    data class Shipping(val sellerId: Long, val fee: Long)

    companion object {
        fun from(sheet: OrderSheet) = OrderSheetResult(
            id = requireNotNull(sheet.id) { "저장 전 주문서" },
            memberId = sheet.memberId,
            status = sheet.status,
            userCouponId = sheet.userCouponId,
            couponDefinitionId = sheet.couponDefinitionId,
            itemsAmount = sheet.itemsAmount,
            couponDiscount = sheet.couponDiscount,
            pointAmount = sheet.pointAmount,
            shippingAmount = sheet.shippingAmount,
            payableAmount = sheet.payableAmount,
            expiresAt = sheet.expiresAt,
            createdAt = sheet.createdAt,
            lines = sheet.lines.map {
                Line(
                    it.lineNo, it.productId, it.productName, it.sellerId, it.unitPrice, it.quantity, it.amount,
                    it.couponDiscount, it.couponBearer, it.pointAmount, it.commissionRateBp, it.payable,
                )
            },
            shippingLines = sheet.shippingLines.map { Shipping(it.sellerId, it.fee) },
        )
    }
}
