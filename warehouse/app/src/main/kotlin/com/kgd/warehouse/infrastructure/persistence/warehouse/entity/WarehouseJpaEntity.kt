package com.kgd.warehouse.infrastructure.persistence.warehouse.entity

import com.kgd.warehouse.domain.warehouse.model.Warehouse
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "warehouse")
class WarehouseJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 100)
    val name: String,

    @Column(nullable = false, length = 255)
    val address: String,

    @Column(nullable = false)
    val latitude: Double,

    @Column(nullable = false)
    val longitude: Double,

    @Column(nullable = false)
    val active: Boolean,

    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    fun toDomain(): Warehouse = Warehouse.restore(
        id = id,
        name = name,
        address = address,
        latitude = latitude,
        longitude = longitude,
        active = active,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(warehouse: Warehouse): WarehouseJpaEntity = WarehouseJpaEntity(
            id = warehouse.id,
            name = warehouse.name,
            address = warehouse.address,
            latitude = warehouse.latitude,
            longitude = warehouse.longitude,
            active = warehouse.active,
            createdAt = warehouse.createdAt,
        )
    }
}
