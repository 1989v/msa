package com.kgd.search.infrastructure.elasticsearch

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.port.ProductSearchPort
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.SearchHitSupport
import org.springframework.data.elasticsearch.core.query.Criteria
import org.springframework.data.elasticsearch.core.query.CriteriaQuery
import org.springframework.stereotype.Component

@Component
class ProductSearchAdapter(
    private val elasticsearchOperations: ElasticsearchOperations
) : ProductSearchPort {

    override fun search(keyword: String, pageable: Pageable): Page<ProductDocument> {
        val criteria = Criteria("name").matches(keyword)
            .and(Criteria("status").`is`("ACTIVE"))
        val query = CriteriaQuery(criteria, pageable)

        val searchHits = elasticsearchOperations.search(query, ProductEsDocument::class.java)
        val searchPage = SearchHitSupport.searchPageFor(searchHits, pageable)
        // Spring Data Elasticsearch SearchHitSupport.unwrapSearchHits returns SearchHits<T>
        // mapped to Page<T>, which requires an unchecked cast at the call site.
        @Suppress("UNCHECKED_CAST")
        val esPage = SearchHitSupport.unwrapSearchHits(searchPage) as Page<ProductEsDocument>
        return PageImpl(
            esPage.content.map { it.toDomain() },
            esPage.pageable,
            esPage.totalElements
        )
    }
}
