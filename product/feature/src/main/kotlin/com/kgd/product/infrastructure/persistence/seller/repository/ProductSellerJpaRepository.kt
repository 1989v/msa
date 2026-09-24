package com.kgd.product.infrastructure.persistence.seller.repository

import com.kgd.product.domain.seller.model.ProductSellerStatus
import com.kgd.product.infrastructure.persistence.seller.entity.ProductSellerJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ProductSellerJpaRepository : JpaRepository<ProductSellerJpaEntity, Long> {
    fun findFirstByMemberIdAndStatus(memberId: String, status: ProductSellerStatus): ProductSellerJpaEntity?
}
