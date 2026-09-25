package com.kgd.inventory.infrastructure.persistence.ownership.repository

import com.kgd.inventory.domain.ownership.model.OwnerSellerStatus
import com.kgd.inventory.infrastructure.persistence.ownership.entity.OwnerSellerJpaEntity
import com.kgd.inventory.infrastructure.persistence.ownership.entity.ProductOwnerJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface InventoryProductOwnerJpaRepository : JpaRepository<ProductOwnerJpaEntity, Long>

interface InventoryOwnerSellerJpaRepository : JpaRepository<OwnerSellerJpaEntity, Long> {
    fun findFirstByMemberIdAndStatus(memberId: String, status: OwnerSellerStatus): OwnerSellerJpaEntity?
}
