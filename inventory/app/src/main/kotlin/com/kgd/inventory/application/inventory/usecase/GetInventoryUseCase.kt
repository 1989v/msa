package com.kgd.inventory.application.inventory.usecase

interface GetInventoryUseCase {
    fun execute(query: Query): List<Result>

    data class Query(val productId: Long)
    data class Result(val warehouseId: Long, val availableQty: Int, val reservedQty: Int)
}
