package com.kgd.seller.infrastructure.persistence.adminaction.repository

import com.kgd.seller.infrastructure.persistence.adminaction.entity.SellerAdminActionJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface SellerAdminActionJpaRepository : JpaRepository<SellerAdminActionJpaEntity, Long> {
    fun findAllBySellerIdOrderByIdAsc(sellerId: Long): List<SellerAdminActionJpaEntity>
}
