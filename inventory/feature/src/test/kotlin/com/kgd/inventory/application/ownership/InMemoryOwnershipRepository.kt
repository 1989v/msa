package com.kgd.inventory.application.ownership

import com.kgd.inventory.application.ownership.port.OwnershipRepositoryPort
import com.kgd.inventory.domain.ownership.model.OwnerSeller
import com.kgd.inventory.domain.ownership.model.ProductOwner

class InMemoryOwnershipRepository : OwnershipRepositoryPort {
    private val sellers = mutableMapOf<Long, OwnerSeller>()
    private val owners = mutableMapOf<Long, ProductOwner>()

    fun clear() {
        sellers.clear()
        owners.clear()
    }

    override fun findSeller(sellerId: Long): OwnerSeller? = sellers[sellerId]
    override fun findActiveSellerByMemberId(memberId: String): OwnerSeller? =
        sellers.values.firstOrNull { it.memberId == memberId && it.isActive }
    override fun saveSeller(seller: OwnerSeller) { sellers[seller.sellerId] = seller }
    override fun findProductOwner(productId: Long): ProductOwner? = owners[productId]
    override fun findProductOwners(productIds: Collection<Long>): List<ProductOwner> = productIds.mapNotNull { owners[it] }
    override fun saveProductOwner(owner: ProductOwner) { owners[owner.productId] = owner }
}
