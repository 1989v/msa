package com.kgd.fulfillment.infrastructure.persistence.ownership.repository

import com.kgd.fulfillment.domain.ownership.model.OwnerSellerStatus
import com.kgd.fulfillment.infrastructure.persistence.ownership.entity.OwnerSellerJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.ownership.entity.ProductOwnerJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface FulfillmentProductOwnerJpaRepository : JpaRepository<ProductOwnerJpaEntity, Long>

interface FulfillmentOwnerSellerJpaRepository : JpaRepository<OwnerSellerJpaEntity, Long> {
    fun findFirstByMemberIdAndStatus(memberId: String, status: OwnerSellerStatus): OwnerSellerJpaEntity?
}
