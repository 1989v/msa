package com.kgd.search.domain.product.port

import com.kgd.search.domain.product.model.ProductDocument
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ProductSearchPort {
    fun search(keyword: String, pageable: Pageable): Page<ProductDocument>
}
