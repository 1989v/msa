package com.kgd.order.presentation.sheet.dto

import com.kgd.order.application.sheet.usecase.CreateOrderSheetUseCase
import com.kgd.order.application.sheet.usecase.OrderSheetResult
import com.kgd.order.domain.benefit.model.CouponBearer
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Positive
import jakarta.validation.constraints.PositiveOrZero
import java.time.Instant

/**
 * 주문서 요청. **가격·금액 필드가 없다** — 요청 JSON 에 넣어도 역직렬화에서 버려지고 금액은 읽기 모델에서만 온다.
 * `items` 와 `fromCart` 중 하나만 준다.
 */
data class CreateOrderSheetRequest(
    @field:Valid
    val items: List<OrderSheetItemRequest>? = null,
    val fromCart: Boolean = false,
    @field:Positive(message = "쿠폰 id 는 0보다 커야 합니다")
    val userCouponId: Long? = null,
    @field:PositiveOrZero(message = "포인트는 0 이상이어야 합니다")
    val pointAmount: Long = 0L,
) {
    fun toCommand(memberId: String) = CreateOrderSheetUseCase.Command(
        memberId = memberId,
        items = items?.map { CreateOrderSheetUseCase.Item(it.productId, it.quantity) },
        fromCart = fromCart,
        userCouponId = userCouponId,
        pointAmount = pointAmount,
    )
}

data class OrderSheetItemRequest(
    @field:Positive(message = "상품 ID는 0보다 커야 합니다")
    val productId: Long,
    @field:Min(value = 1, message = "수량은 1 이상이어야 합니다")
    @field:Max(value = 999, message = "수량이 너무 많습니다")
    val quantity: Int,
)

/** 구매자에게 보이는 주문서 — 판매자 수수료율은 내보내지 않는다 */
data class OrderSheetResponse(
    val id: Long,
    val status: String,
    val userCouponId: Long?,
    val itemsAmount: Long,
    val couponDiscount: Long,
    val pointAmount: Long,
    val shippingAmount: Long,
    val payableAmount: Long,
    val expiresAt: Instant,
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
        val payable: Long,
    )

    data class Shipping(val sellerId: Long, val fee: Long)

    companion object {
        fun from(r: OrderSheetResult) = OrderSheetResponse(
            id = r.id,
            status = r.status.name,
            userCouponId = r.userCouponId,
            itemsAmount = r.itemsAmount,
            couponDiscount = r.couponDiscount,
            pointAmount = r.pointAmount,
            shippingAmount = r.shippingAmount,
            payableAmount = r.payableAmount,
            expiresAt = r.expiresAt,
            lines = r.lines.map {
                Line(it.lineNo, it.productId, it.productName, it.sellerId, it.unitPrice, it.quantity, it.amount, it.couponDiscount,
                    it.couponBearer, it.pointAmount, it.payable)
            },
            shippingLines = r.shippingLines.map { Shipping(it.sellerId, it.fee) },
        )
    }
}
