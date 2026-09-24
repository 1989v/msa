package com.kgd.order.application.order.usecase

interface PlaceOrderUseCase {
    suspend fun execute(command: Command): Result

    data class Command(
        val userId: String,
        val items: List<OrderItemCommand>
    )

    /** 가격은 받지 않는다 — 단가는 서버가 정한다 */
    data class OrderItemCommand(
        val productId: Long,
        val quantity: Int,
    )

    data class Result(
        val orderId: Long,
        val userId: String,
        val totalAmount: Long,
        val status: String
    )
}
