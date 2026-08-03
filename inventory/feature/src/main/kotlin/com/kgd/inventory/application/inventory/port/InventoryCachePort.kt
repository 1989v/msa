package com.kgd.inventory.application.inventory.port

interface InventoryCachePort {
    fun reserveStock(productId: Long, warehouseId: Long, qty: Int): Int?
    fun releaseStock(productId: Long, warehouseId: Long, qty: Int): Int?
    fun confirmStock(productId: Long, warehouseId: Long, qty: Int): Int?
    fun receiveStock(productId: Long, warehouseId: Long, qty: Int): Int?
    fun getStock(productId: Long, warehouseId: Long): CachedInventory?
    fun setStock(productId: Long, warehouseId: Long, availableQty: Int, reservedQty: Int)

    data class CachedInventory(val availableQty: Int, val reservedQty: Int)
}
