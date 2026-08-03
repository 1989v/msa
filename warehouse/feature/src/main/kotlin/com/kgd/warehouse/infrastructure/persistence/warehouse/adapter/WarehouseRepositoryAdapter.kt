package com.kgd.warehouse.infrastructure.persistence.warehouse.adapter

import com.kgd.warehouse.application.warehouse.port.WarehouseRepositoryPort
import com.kgd.warehouse.domain.warehouse.model.Warehouse
import com.kgd.warehouse.infrastructure.persistence.warehouse.entity.WarehouseJpaEntity
import com.kgd.warehouse.infrastructure.persistence.warehouse.repository.WarehouseJpaRepository
import org.springframework.stereotype.Component

@Component
class WarehouseRepositoryAdapter(
    private val jpaRepository: WarehouseJpaRepository,
) : WarehouseRepositoryPort {

    override fun save(warehouse: Warehouse): Warehouse {
        val entity = WarehouseJpaEntity.fromDomain(warehouse)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Warehouse? {
        return jpaRepository.findById(id).orElse(null)?.toDomain()
    }

    override fun findAll(): List<Warehouse> {
        return jpaRepository.findAll().map { it.toDomain() }
    }

    override fun findFirstActiveWarehouse(): Warehouse? {
        return jpaRepository.findFirstByActiveTrue()?.toDomain()
    }
}
