package com.kgd.inventory.application.inventory.usecase

interface ReserveStockUseCase {
    fun execute(command: Command): Result

    data class Command(val orderId: Long, val productId: Long, val warehouseId: Long, val qty: Int)
    data class Result(val reservationId: Long, val productId: Long, val availableQty: Int, val reservedQty: Int)
}
