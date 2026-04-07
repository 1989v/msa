package com.kgd.product.application.product.usecase

interface SyncProductStockUseCase {
    fun execute(command: Command)

    data class Command(
        val productId: Long,
        val availableQty: Int,
    )
}
