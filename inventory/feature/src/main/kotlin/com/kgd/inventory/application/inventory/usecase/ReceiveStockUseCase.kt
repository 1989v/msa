package com.kgd.inventory.application.inventory.usecase

interface ReceiveStockUseCase {
    fun execute(command: Command): Result

    data class Command(val productId: Long, val warehouseId: Long, val qty: Int)
    data class Result(val productId: Long, val availableQty: Int)
}
