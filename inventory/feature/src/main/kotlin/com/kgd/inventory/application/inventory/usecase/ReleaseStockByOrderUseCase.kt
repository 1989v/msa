package com.kgd.inventory.application.inventory.usecase

interface ReleaseStockByOrderUseCase {
    fun execute(command: Command): List<Result>

    data class Command(val orderId: Long)
    data class Result(val productId: Long, val availableQty: Int, val reservedQty: Int)
}
