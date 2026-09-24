package com.kgd.inventory.infrastructure.persistence.inventory.repository

import com.kgd.inventory.infrastructure.persistence.inventory.entity.InventoryJpaEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface InventoryJpaRepository : JpaRepository<InventoryJpaEntity, Long> {
    fun findByProductIdAndWarehouseId(productId: Long, warehouseId: Long): InventoryJpaEntity?
    fun findAllByProductId(productId: Long): List<InventoryJpaEntity>

    @Query("SELECT i.id FROM InventoryJpaEntity i WHERE i.productId IN :productIds ORDER BY i.id")
    fun findIdsByProductIdIn(@Param("productIds") productIds: Collection<Long>): List<Long>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM InventoryJpaEntity i WHERE i.id = :id")
    fun findByIdForUpdate(@Param("id") id: Long): InventoryJpaEntity?
}
