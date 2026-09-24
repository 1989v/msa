package com.kgd.product.infrastructure.persistence.seller.adapter

import com.kgd.product.application.seller.port.ProductSellerRepositoryPort
import com.kgd.product.domain.seller.model.ProductSeller
import com.kgd.product.domain.seller.model.ProductSellerStatus
import com.kgd.product.infrastructure.persistence.seller.entity.ProductSellerJpaEntity
import com.kgd.product.infrastructure.persistence.seller.repository.ProductSellerJpaRepository
import org.springframework.stereotype.Component

@Component
class ProductSellerRepositoryAdapter(
    private val jpaRepository: ProductSellerJpaRepository,
) : ProductSellerRepositoryPort {

    override fun findById(sellerId: Long): ProductSeller? =
        jpaRepository.findById(sellerId).orElse(null)?.toDomain()

    override fun findActiveByMemberId(memberId: String): ProductSeller? =
        jpaRepository.findFirstByMemberIdAndStatus(memberId, ProductSellerStatus.ACTIVE)?.toDomain()

    override fun save(seller: ProductSeller): ProductSeller {
        val entity = jpaRepository.findById(seller.sellerId).orElse(null)
            ?.also { it.update(seller) }
            ?: ProductSellerJpaEntity.fromDomain(seller)
        return jpaRepository.save(entity).toDomain()
    }
}
