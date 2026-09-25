package com.kgd.fulfillment.infrastructure.persistence.ownership.adapter

import com.kgd.fulfillment.application.ownership.port.OwnershipRepositoryPort
import com.kgd.fulfillment.domain.ownership.model.OwnerSeller
import com.kgd.fulfillment.domain.ownership.model.OwnerSellerStatus
import com.kgd.fulfillment.domain.ownership.model.ProductOwner
import com.kgd.fulfillment.infrastructure.persistence.ownership.entity.OwnerSellerJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.ownership.entity.ProductOwnerJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.ownership.repository.FulfillmentOwnerSellerJpaRepository
import com.kgd.fulfillment.infrastructure.persistence.ownership.repository.FulfillmentProductOwnerJpaRepository
import org.springframework.stereotype.Component

@Component
class FulfillmentOwnershipRepositoryAdapter(
    private val sellers: FulfillmentOwnerSellerJpaRepository,
    private val owners: FulfillmentProductOwnerJpaRepository,
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
