package com.kgd.inventory.application.inventory.port

import com.kgd.inventory.domain.inventory.model.Inventory

interface InventoryRepositoryPort {
    fun save(inventory: Inventory): Inventory
    fun findByProductIdAndWarehouseId(productId: Long, warehouseId: Long): Inventory?
    fun findAllByProductId(productId: Long): List<Inventory>
    fun findAll(): List<Inventory>

    /**
     * 주문 예약용 — 상품들의 재고 행을 inventory id 오름차순으로 `FOR UPDATE` 잠가 돌려준다.
     * 호출자의 트랜잭션이 끝날 때까지 잠금이 유지된다. 모든 주문이 같은 순서로 잠가야 교착이 생기지 않는다.
     */
    fun lockAllByProductIds(productIds: Collection<Long>): List<Inventory>
}
