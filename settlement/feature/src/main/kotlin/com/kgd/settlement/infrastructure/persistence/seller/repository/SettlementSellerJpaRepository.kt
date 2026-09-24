package com.kgd.settlement.infrastructure.persistence.seller.repository

import com.kgd.settlement.infrastructure.persistence.seller.entity.SettlementSellerJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface SettlementSellerJpaRepository : JpaRepository<SettlementSellerJpaEntity, Long> {
    fun findFirstByMemberIdAndStatus(memberId: String, status: String): SettlementSellerJpaEntity?
}
