package com.kgd.product.application.product.service

import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.domain.product.exception.ProductNotFoundException
import com.kgd.product.domain.product.model.Product
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 상품 저장소 트랜잭션 경계. 쓰기는 [ProductService] 가 연 트랜잭션에 합류해
 * 아웃박스 행과 함께 커밋된다.
 */
@Service
@Transactional
@Qualifier("productTransactionManager")
class ProductTransactionalService(
    private val productRepository: ProductRepositoryPort
) {
    fun save(product: Product): Product = productRepository.save(product)

    /** 대량 적재 — 청크 전체를 한 트랜잭션으로 저장 */
    fun saveAll(products: List<Product>): List<Product> = productRepository.saveAll(products)

    @Transactional(readOnly = true)
    fun findById(id: Long): Product = productRepository.findById(id)
        ?: throw ProductNotFoundException(id)

    @Transactional(readOnly = true)
    fun findAll(pageable: Pageable, sellerId: Long?): Page<Product> = productRepository.findAll(pageable, sellerId)
}
