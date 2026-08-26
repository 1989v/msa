package com.kgd.order.presentation.order.dto

import com.kgd.order.application.order.usecase.GetMyOrdersUseCase
import java.math.BigDecimal
import java.time.LocalDateTime

data class MyOrderResponse(
    val orderId: Long,
    val totalAmount: BigDecimal,
    val status: String,
    val createdAt: LocalDateTime,
    val items: List<MyOrderItemResponse>,
) {
    companion object {
        fun from(result: GetMyOrdersUseCase.Result) = MyOrderResponse(
            orderId = result.orderId,
            totalAmount = result.totalAmount,
            status = result.status,
            createdAt = result.createdAt,
            items = result.items.map { MyOrderItemResponse(it.productId, it.quantity, it.unitPrice) },
        )
    }
}

data class MyOrderItemResponse(
    val productId: Long,
    val quantity: Int,
    val unitPrice: BigDecimal,
)
