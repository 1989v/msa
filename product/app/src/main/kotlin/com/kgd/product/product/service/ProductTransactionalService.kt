package com.kgd.product.application.product.service

import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.domain.product.exception.ProductNotFoundException
import com.kgd.product.domain.product.model.Product
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Handles transactional DB operations for product management.
 * Separated from ProductService to ensure Kafka events are only published
 * after the transaction commits, preventing phantom events on rollback.
 */
@Service
@Transactional
class ProductTransactionalService(
    private val productRepository: ProductRepositoryPort
) {
    fun save(product: Product): Product = productRepository.save(product)

    @Transactional(readOnly = true)
    fun findById(id: Long): Product = productRepository.findById(id)
        ?: throw ProductNotFoundException(id)

    @Transactional(readOnly = true)
    fun findAll(pageable: Pageable): Page<Product> = productRepository.findAll(pageable)
}
