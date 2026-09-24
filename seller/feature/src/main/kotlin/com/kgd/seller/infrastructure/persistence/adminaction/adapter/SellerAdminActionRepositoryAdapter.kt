package com.kgd.seller.infrastructure.persistence.adminaction.adapter

import com.kgd.seller.application.seller.port.SellerAdminActionRepositoryPort
import com.kgd.seller.domain.seller.model.SellerAdminAction
import com.kgd.seller.infrastructure.persistence.adminaction.entity.SellerAdminActionJpaEntity
import com.kgd.seller.infrastructure.persistence.adminaction.repository.SellerAdminActionJpaRepository
import org.springframework.stereotype.Component

@Component
class SellerAdminActionRepositoryAdapter(
    private val jpaRepository: SellerAdminActionJpaRepository,
) : SellerAdminActionRepositoryPort {

    override fun record(action: SellerAdminAction) {
        jpaRepository.save(SellerAdminActionJpaEntity.from(action))
    }

    override fun findAllBySellerId(sellerId: Long): List<SellerAdminAction> =
        jpaRepository.findAllBySellerIdOrderByIdAsc(sellerId).map { it.toDomain() }
}
