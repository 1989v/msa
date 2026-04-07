package com.kgd.inventory.domain.inventory.event

sealed class InventoryEvent {
    data class StockReserved(val productId: Long, val warehouseId: Long, val qty: Int, val orderId: Long) : InventoryEvent()
    data class StockReleased(val productId: Long, val warehouseId: Long, val qty: Int, val orderId: Long) : InventoryEvent()
    data class StockConfirmed(val productId: Long, val warehouseId: Long, val qty: Int, val orderId: Long) : InventoryEvent()
    data class StockReceived(val productId: Long, val warehouseId: Long, val qty: Int) : InventoryEvent()
}
