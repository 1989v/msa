package com.kgd.order.presentation.order.dto

import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase

data class OrderResponse(
    val orderId: Long,
    val userId: String,
    val totalAmount: Long,
    val status: String
) {
    companion object {
        fun from(result: PlaceOrderUseCase.Result) = OrderResponse(result.orderId, result.userId, result.totalAmount, result.status)
        fun from(result: GetOrderUseCase.Result) = OrderResponse(result.orderId, result.userId, result.totalAmount, result.status)
    }
}
