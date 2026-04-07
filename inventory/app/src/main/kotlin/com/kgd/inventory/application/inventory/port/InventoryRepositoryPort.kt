package com.kgd.inventory.application.inventory.port

import com.kgd.inventory.domain.inventory.model.Inventory

interface InventoryRepositoryPort {
    fun save(inventory: Inventory): Inventory
    fun findByProductIdAndWarehouseId(productId: Long, warehouseId: Long): Inventory?
    fun findAllByProductId(productId: Long): List<Inventory>
}
