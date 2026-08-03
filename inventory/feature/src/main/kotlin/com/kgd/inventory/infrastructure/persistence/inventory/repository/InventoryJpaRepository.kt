package com.kgd.inventory.infrastructure.persistence.inventory.repository

import com.kgd.inventory.infrastructure.persistence.inventory.entity.InventoryJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface InventoryJpaRepository : JpaRepository<InventoryJpaEntity, Long> {
    fun findByProductIdAndWarehouseId(productId: Long, warehouseId: Long): InventoryJpaEntity?
    fun findAllByProductId(productId: Long): List<InventoryJpaEntity>
}
