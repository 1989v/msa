package com.kgd.search.infrastructure.elasticsearch

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.model.ScoredProductDocument
import com.kgd.search.domain.product.port.ProductSearchPort
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.SearchHits
import org.springframework.stereotype.Component

@Component
class ProductSearchAdapter(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val rankingProperties: RankingProperties,
    private val queryBuilder: RankingQueryBuilder
) : ProductSearchPort {

    override fun search(keyword: String, pageable: Pageable): Page<ProductDocument> {
        val hits = executeSearch(keyword, pageable)
        val content = hits.searchHits.map { it.content.toDomain() }
        return PageImpl(content, pageable, hits.totalHits)
    }

    override fun searchScored(keyword: String, pageable: Pageable): Page<ScoredProductDocument> {
        val hits = executeSearch(keyword, pageable)
        val content = hits.searchHits.map { ScoredProductDocument(it.content.toDomain(), it.score.toDouble()) }
        return PageImpl(content, pageable, hits.totalHits)
    }

    private fun executeSearch(keyword: String, pageable: Pageable): SearchHits<ProductEsDocument> {
        val query = queryBuilder.build(keyword, pageable, rankingProperties)
        return elasticsearchOperations.search(query, ProductEsDocument::class.java)
    }
}
