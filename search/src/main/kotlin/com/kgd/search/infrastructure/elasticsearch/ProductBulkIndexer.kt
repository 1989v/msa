package com.kgd.search.infrastructure.elasticsearch

import com.kgd.search.application.product.port.ProductIndexPort
import com.kgd.search.domain.product.model.ProductDocument
import org.slf4j.LoggerFactory
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder
import org.springframework.stereotype.Component

@Component
class ProductBulkIndexer(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val repository: ProductElasticsearchRepository
) : ProductIndexPort {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun indexProduct(document: ProductDocument) {
        repository.save(document)
        log.info("Indexed product: id={}, name={}", document.id, document.name)
    }

    override fun bulkIndex(documents: List<ProductDocument>) {
        if (documents.isEmpty()) return

        val queries = documents.map { doc ->
            IndexQueryBuilder()
                .withId(doc.id)
                .withObject(doc)
                .build()
        }
        elasticsearchOperations.bulkIndex(queries, ProductDocument::class.java)
        log.info("Bulk indexed {} products", documents.size)
    }
}
