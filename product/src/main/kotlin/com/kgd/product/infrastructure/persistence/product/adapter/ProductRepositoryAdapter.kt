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

    override fun save(product: Product): Product {
        val entity = if (product.id != null) {
            jpaRepository.findById(product.id).orElseThrow {
                com.kgd.product.domain.product.exception.ProductNotFoundException(product.id)
            }.also { e ->
                e.name = product.name
                e.price = product.price.amount
                e.stock = product.stock
                e.status = product.status
            }
        } else {
            ProductJpaEntity.fromDomain(product)
        }
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Product? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAll(pageable: Pageable): Page<Product> =
        queryRepository.findAllByStatus(ProductStatus.ACTIVE, pageable).map { it.toDomain() }
}
