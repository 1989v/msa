package com.kgd.warehouse.application.warehouse.port

import com.kgd.warehouse.domain.warehouse.model.Warehouse

interface WarehouseRepositoryPort {
    fun save(warehouse: Warehouse): Warehouse
    fun findById(id: Long): Warehouse?
    fun findAll(): List<Warehouse>
    fun findFirstActiveWarehouse(): Warehouse?
}
