package com.kgd.inventory.infrastructure.persistence.inventory.adapter

import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.infrastructure.persistence.inventory.entity.InventoryJpaEntity
import com.kgd.inventory.infrastructure.persistence.inventory.repository.InventoryJpaRepository
import org.springframework.stereotype.Component

@Component
class InventoryRepositoryAdapter(
    private val jpaRepository: InventoryJpaRepository,
) : InventoryRepositoryPort {

    override fun save(inventory: Inventory): Inventory {
        val entity = InventoryJpaEntity.fromDomain(inventory)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findByProductIdAndWarehouseId(productId: Long, warehouseId: Long): Inventory? {
        return jpaRepository.findByProductIdAndWarehouseId(productId, warehouseId)?.toDomain()
    }

    override fun findAllByProductId(productId: Long): List<Inventory> {
        return jpaRepository.findAllByProductId(productId).map { it.toDomain() }
    }

    override fun findAll(): List<Inventory> {
        return jpaRepository.findAll().map { it.toDomain() }
    }
}
