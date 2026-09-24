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

    /**
     * 한 행씩 id 오름차순으로 잠근다. `id IN (...) FOR UPDATE` 한 번으로 잡으면 잠금 순서가
     * 실행 계획에 맡겨지므로, 순서를 코드로 고정한다(한 주문의 라인 수만큼이라 왕복 수는 작다).
     * id 조회와 잠금 사이에 지워진 행은 건너뛴다.
     */
    override fun lockAllByProductIds(productIds: Collection<Long>): List<Inventory> {
        if (productIds.isEmpty()) return emptyList()
        return jpaRepository.findIdsByProductIdIn(productIds.distinct())
            .sorted()
            .mapNotNull { jpaRepository.findByIdForUpdate(it)?.toDomain() }
    }
}
