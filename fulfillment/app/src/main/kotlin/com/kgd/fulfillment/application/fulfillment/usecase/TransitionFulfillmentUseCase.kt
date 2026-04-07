package com.kgd.fulfillment.application.fulfillment.usecase

interface TransitionFulfillmentUseCase {
    fun execute(command: Command): Result

    data class Command(val fulfillmentId: Long, val targetStatus: String)
    data class Result(val fulfillmentId: Long, val orderId: Long, val fromStatus: String, val toStatus: String)
}
