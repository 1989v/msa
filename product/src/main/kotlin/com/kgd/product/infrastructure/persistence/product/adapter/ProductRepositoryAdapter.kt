package com.kgd.product.infrastructure.persistence.product.adapter

import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.domain.product.model.Product
import com.kgd.product.domain.product.model.ProductStatus
import com.kgd.product.infrastructure.persistence.product.entity.ProductJpaEntity
import com.kgd.product.infrastructure.persistence.product.repository.ProductJpaRepository
import com.kgd.product.infrastructure.persistence.product.repository.ProductQueryRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

@Component
class ProductRepositoryAdapter(
    private val jpaRepository: ProductJpaRepository,
    private val queryRepository: ProductQueryRepository
) : ProductRepositoryPort {

    override fun save(product: Product): Product =
        jpaRepository.save(ProductJpaEntity.fromDomain(product)).toDomain()

    override fun findById(id: Long): Product? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAll(pageable: Pageable): Page<Product> =
        queryRepository.findAllByStatus(ProductStatus.ACTIVE, pageable).map { it.toDomain() }
}
