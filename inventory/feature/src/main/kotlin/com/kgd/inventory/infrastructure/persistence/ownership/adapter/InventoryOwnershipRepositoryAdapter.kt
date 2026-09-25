package com.kgd.inventory.infrastructure.persistence.ownership.adapter

import com.kgd.inventory.application.ownership.port.OwnershipRepositoryPort
import com.kgd.inventory.domain.ownership.model.OwnerSeller
import com.kgd.inventory.domain.ownership.model.OwnerSellerStatus
import com.kgd.inventory.domain.ownership.model.ProductOwner
import com.kgd.inventory.infrastructure.persistence.ownership.entity.OwnerSellerJpaEntity
import com.kgd.inventory.infrastructure.persistence.ownership.entity.ProductOwnerJpaEntity
import com.kgd.inventory.infrastructure.persistence.ownership.repository.InventoryOwnerSellerJpaRepository
import com.kgd.inventory.infrastructure.persistence.ownership.repository.InventoryProductOwnerJpaRepository
import org.springframework.stereotype.Component

@Component
class InventoryOwnershipRepositoryAdapter(
    private val sellers: InventoryOwnerSellerJpaRepository,
    private val owners: InventoryProductOwnerJpaRepository,
) : OwnershipRepositoryPort {

    override fun findSeller(sellerId: Long): OwnerSeller? = sellers.findById(sellerId).orElse(null)?.toDomain()

    override fun findActiveSellerByMemberId(memberId: String): OwnerSeller? =
        sellers.findFirstByMemberIdAndStatus(memberId, OwnerSellerStatus.ACTIVE)?.toDomain()

    override fun saveSeller(seller: OwnerSeller) {
        val entity = sellers.findById(seller.sellerId).orElse(null)?.also { it.update(seller) }
            ?: OwnerSellerJpaEntity.fromDomain(seller)
        sellers.save(entity)
    }

    override fun findProductOwner(productId: Long): ProductOwner? = owners.findById(productId).orElse(null)?.toDomain()

    override fun findProductOwners(productIds: Collection<Long>): List<ProductOwner> =
        if (productIds.isEmpty()) emptyList() else owners.findAllById(productIds).map { it.toDomain() }

    override fun saveProductOwner(owner: ProductOwner) {
        val entity = owners.findById(owner.productId).orElse(null)?.also { it.update(owner) }
            ?: ProductOwnerJpaEntity.fromDomain(owner)
        owners.save(entity)
    }
}
