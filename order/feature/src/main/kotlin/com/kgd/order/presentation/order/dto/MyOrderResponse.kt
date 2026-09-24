package com.kgd.order.presentation.order.dto

import com.kgd.order.application.order.usecase.OrderDetail
import java.time.LocalDateTime

/** 내 주문 목록 한 줄. [totalAmount] 는 결제액(쿠폰·포인트 차감 + 배송비) */
data class MyOrderResponse(
    val orderId: Long,
    val totalAmount: Long,
    val status: String,
    val failureReason: String?,
    val refundedAmount: Long,
    val createdAt: LocalDateTime,
    val items: List<MyOrderItemResponse>,
) {
    companion object {
        fun from(d: OrderDetail) = MyOrderResponse(
            orderId = d.orderId,
            totalAmount = d.payableAmount,
            status = d.status,
            failureReason = d.failureReason,
            refundedAmount = d.refundedAmount,
            createdAt = d.createdAt,
            items = d.lines.map { MyOrderItemResponse(it.productId, it.productName, it.quantity, it.unitPrice, it.status) },
        )
    }
}

data class MyOrderItemResponse(
    val productId: Long,
    val productName: String,
    val quantity: Int,
    val unitPrice: Long,
    val status: String,
)
