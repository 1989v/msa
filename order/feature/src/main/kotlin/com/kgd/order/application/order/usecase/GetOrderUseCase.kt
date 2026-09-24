package com.kgd.order.application.order.usecase


interface GetOrderUseCase {
    fun execute(id: Long): Result

    data class Result(
        val orderId: Long,
        val userId: String,
        val totalAmount: Long,
        val status: String
    )
}
