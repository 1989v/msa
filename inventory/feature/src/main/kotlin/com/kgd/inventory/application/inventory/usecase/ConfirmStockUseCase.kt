package com.kgd.inventory.application.inventory.usecase

interface ConfirmStockUseCase {
    fun execute(command: Command): Result

    data class Command(val orderId: Long, val productId: Long)
    data class Result(val productId: Long, val availableQty: Int, val reservedQty: Int)
}
