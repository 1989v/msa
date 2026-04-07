package com.kgd.inventory.application.inventory.usecase

interface ReleaseStockUseCase {
    fun execute(command: Command): Result

    data class Command(val orderId: Long, val productId: Long)
    data class Result(val productId: Long, val availableQty: Int, val reservedQty: Int)
}
