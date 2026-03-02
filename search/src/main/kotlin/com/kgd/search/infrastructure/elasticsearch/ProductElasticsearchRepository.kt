package com.kgd.search.infrastructure.elasticsearch

import com.kgd.search.domain.product.model.ProductDocument
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository

interface ProductElasticsearchRepository : ElasticsearchRepository<ProductDocument, String> {
    fun findByNameContaining(name: String, pageable: Pageable): Page<ProductDocument>
}
