package com.kgd.search.infrastructure.elasticsearch

import com.kgd.search.domain.product.port.ProductIndexPort
import com.kgd.search.domain.product.model.ProductDocument
import org.slf4j.LoggerFactory
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.query.IndexQuery
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder
import org.springframework.stereotype.Component

@Component
class ProductBulkIndexer(
    private val elasticsearchOperations: ElasticsearchOperations
) : ProductIndexPort {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun indexProduct(document: ProductDocument) {
        elasticsearchOperations.save(ProductEsDocument.fromDomain(document))
        log.info("Indexed product: id={}, name={}", document.id, document.name)
    }

    override fun bulkIndex(documents: List<ProductDocument>) {
        if (documents.isEmpty()) return
        val queries: List<IndexQuery> = documents.map { doc ->
            IndexQueryBuilder()
                .withId(doc.id)
                .withObject(ProductEsDocument.fromDomain(doc))
                .build()
        }
        elasticsearchOperations.bulkIndex(queries, ProductEsDocument::class.java)
        log.info("Bulk indexed {} products", documents.size)
    }
}
