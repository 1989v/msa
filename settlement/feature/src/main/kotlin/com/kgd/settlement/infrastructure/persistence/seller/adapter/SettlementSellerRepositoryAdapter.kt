package com.kgd.settlement.infrastructure.persistence.seller.adapter

import com.kgd.settlement.application.seller.port.SettlementSellerRepositoryPort
import com.kgd.settlement.domain.seller.model.SettlementSeller
import com.kgd.settlement.infrastructure.persistence.seller.entity.SettlementSellerJpaEntity
import com.kgd.settlement.infrastructure.persistence.seller.repository.SettlementSellerJpaRepository
import org.springframework.stereotype.Component

@Component
class SettlementSellerRepositoryAdapter(
    private val repository: SettlementSellerJpaRepository,
) : SettlementSellerRepositoryPort {

    override fun find(sellerId: Long): SettlementSeller? = repository.findById(sellerId).orElse(null)?.toDomain()

    override fun findActiveByMemberId(memberId: String): SettlementSeller? =
        repository.findFirstByMemberIdAndStatus(memberId, SettlementSeller.ACTIVE)?.toDomain()

    override fun save(seller: SettlementSeller) {
        val entity = repository.findById(seller.sellerId).orElse(null)
            ?.apply { syncFrom(seller) }
            ?: SettlementSellerJpaEntity(seller.sellerId, seller.memberId, seller.status, seller.cycle, seller.occurredAt)
        repository.save(entity)
    }
}
