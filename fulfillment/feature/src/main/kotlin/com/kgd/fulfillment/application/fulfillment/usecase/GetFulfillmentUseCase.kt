package com.kgd.fulfillment.application.fulfillment.usecase

import java.time.LocalDateTime

interface GetFulfillmentUseCase {
    fun findById(id: Long): Result
    fun findByOrderId(orderId: Long): Result
    fun findAllByOrderId(orderId: Long): List<Result>

    data class Result(
        val fulfillmentId: Long,
        val orderId: Long,
        val warehouseId: Long,
        val status: String,
        val createdAt: LocalDateTime
    )
}
