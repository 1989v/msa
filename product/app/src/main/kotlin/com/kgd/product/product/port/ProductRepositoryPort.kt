package com.kgd.product.application.product.port

import com.kgd.product.domain.product.model.Product
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ProductRepositoryPort {
    fun save(product: Product): Product
    fun findById(id: Long): Product?
    fun findAll(pageable: Pageable): Page<Product>
}
