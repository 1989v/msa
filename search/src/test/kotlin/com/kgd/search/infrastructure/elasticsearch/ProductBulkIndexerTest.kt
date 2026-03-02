package com.kgd.search.infrastructure.elasticsearch

import com.kgd.search.domain.product.model.ProductDocument
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.query.IndexQuery
import java.math.BigDecimal

class ProductBulkIndexerTest : BehaviorSpec({
    val elasticsearchOperations = mockk<ElasticsearchOperations>(relaxed = true)
    val indexer = ProductBulkIndexer(elasticsearchOperations)

    beforeEach { clearMocks(elasticsearchOperations) }

    given("단일 상품 인덱싱 시") {
        `when`("유효한 ProductDocument가 주어지면") {
            then("elasticsearchOperations.save()가 호출되어야 한다") {
                val doc = ProductDocument("1", "테스트 상품", BigDecimal("10000"), "ACTIVE")
                every { elasticsearchOperations.save(doc) } returns doc

                indexer.indexProduct(doc)

                verify(exactly = 1) { elasticsearchOperations.save(doc) }
            }
        }
    }

    given("벌크 인덱싱 시") {
        `when`("여러 ProductDocument가 주어지면") {
            then("elasticsearchOperations.bulkIndex()가 호출되어야 한다") {
                val docs = listOf(
                    ProductDocument("1", "상품1", BigDecimal("10000"), "ACTIVE"),
                    ProductDocument("2", "상품2", BigDecimal("20000"), "ACTIVE")
                )
                every { elasticsearchOperations.bulkIndex(any<List<IndexQuery>>(), ProductDocument::class.java) } returns listOf()

                indexer.bulkIndex(docs)

                verify(exactly = 1) { elasticsearchOperations.bulkIndex(any<List<IndexQuery>>(), ProductDocument::class.java) }
            }
        }
        `when`("빈 리스트가 주어지면") {
            then("elasticsearchOperations.bulkIndex()가 호출되지 않아야 한다") {
                indexer.bulkIndex(emptyList())

                verify(exactly = 0) { elasticsearchOperations.bulkIndex(any<List<IndexQuery>>(), any<Class<*>>()) }
            }
        }
    }
})
