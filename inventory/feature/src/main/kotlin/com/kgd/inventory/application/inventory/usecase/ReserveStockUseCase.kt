package com.kgd.inventory.application.inventory.usecase

interface ReserveStockUseCase {
    fun execute(command: Command): Result

    /**
     * [warehouseId] 가 null 이면 가용 재고 기반으로 창고를 자동 선택한다
     * ([com.kgd.inventory.domain.inventory.service.WarehouseSelector] 정책).
     */
    data class Command(val orderId: Long, val productId: Long, val warehouseId: Long?, val qty: Int)
    data class Result(val reservationId: Long, val productId: Long, val availableQty: Int, val reservedQty: Int)
}
