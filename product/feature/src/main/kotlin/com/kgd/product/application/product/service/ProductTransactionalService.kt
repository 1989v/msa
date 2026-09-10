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

    /** 대량 적재 — 청크 전체를 한 트랜잭션으로 저장 (커밋 후 호출부에서 이벤트 발행) */
    fun saveAll(products: List<Product>): List<Product> = productRepository.saveAll(products)

    @Transactional(readOnly = true)
    fun findById(id: Long): Product = productRepository.findById(id)
        ?: throw ProductNotFoundException(id)

    @Transactional(readOnly = true)
    fun findAll(pageable: Pageable): Page<Product> = productRepository.findAll(pageable)
}
