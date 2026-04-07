package com.kgd.inventory.infrastructure.persistence.inventory.entity

import com.kgd.inventory.domain.inventory.model.Inventory
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version

@Entity
@Table(name = "inventory")
class InventoryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val productId: Long,

    @Column(nullable = false)
    val warehouseId: Long,

    @Column(nullable = false)
    var availableQty: Int,

    @Column(nullable = false)
    var reservedQty: Int,

    @Version
    @Column(nullable = false)
    var version: Long = 0,
) {
    fun toDomain(): Inventory = Inventory.restore(
        id = id!!,
        productId = productId,
        warehouseId = warehouseId,
        availableQty = availableQty,
        reservedQty = reservedQty,
        version = version,
    )

    companion object {
        fun fromDomain(inv: Inventory): InventoryJpaEntity = InventoryJpaEntity(
            id = inv.id,
            productId = inv.productId,
            warehouseId = inv.warehouseId,
            availableQty = inv.getAvailableQty(),
            reservedQty = inv.getReservedQty(),
            version = inv.version,
        )
    }
}
