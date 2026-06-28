package com.kgd.warehouse.infrastructure.persistence.warehouse.repository

import com.kgd.warehouse.infrastructure.persistence.warehouse.entity.WarehouseJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface WarehouseJpaRepository : JpaRepository<WarehouseJpaEntity, Long> {
    fun findFirstByActiveTrue(): WarehouseJpaEntity?
}
