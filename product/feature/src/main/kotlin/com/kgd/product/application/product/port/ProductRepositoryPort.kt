package com.kgd.product.application.product.port

import com.kgd.product.domain.product.model.Product
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ProductRepositoryPort {
    fun save(product: Product): Product
    fun saveAll(products: List<Product>): List<Product>
    fun findById(id: Long): Product?
    /** 판매 중(ACTIVE) 상품. [sellerId] 가 있으면 그 판매자 것만 */
    fun findAll(pageable: Pageable, sellerId: Long?): Page<Product>
    /** 한 판매자의 상품 — 판매 중지 포함(판매자 포털) */
    fun findAllBySeller(pageable: Pageable, sellerId: Long): Page<Product>
    /** 상태와 무관하게 전부 — 이벤트 재발행용(판매 중지 상품도 읽기 모델에 있어야 한다) */
    fun findAllIncludingInactive(pageable: Pageable): Page<Product>
}
