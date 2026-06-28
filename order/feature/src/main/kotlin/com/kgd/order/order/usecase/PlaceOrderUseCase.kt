package com.kgd.order.application.order.usecase

import java.math.BigDecimal

interface PlaceOrderUseCase {
    suspend fun execute(command: Command): Result

    data class Command(
        val userId: String,
        val items: List<OrderItemCommand>
    )

    data class OrderItemCommand(
        val productId: Long,
        val quantity: Int,
        val unitPrice: BigDecimal
    )

    data class Result(
        val orderId: Long,
        val userId: String,
        val totalAmount: BigDecimal,
        val status: String
    )
}
