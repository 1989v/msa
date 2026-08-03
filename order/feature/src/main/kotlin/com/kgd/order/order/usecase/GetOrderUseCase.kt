package com.kgd.order.application.order.usecase

import java.math.BigDecimal

interface GetOrderUseCase {
    fun execute(id: Long): Result

    data class Result(
        val orderId: Long,
        val userId: String,
        val totalAmount: BigDecimal,
        val status: String
    )
}
