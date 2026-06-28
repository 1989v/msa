package com.kgd.fulfillment.application.fulfillment.usecase

interface CreateFulfillmentUseCase {
    fun execute(command: Command): Result

    data class Command(val orderId: Long, val warehouseId: Long)
    data class Result(val fulfillmentId: Long, val orderId: Long, val status: String)
}
