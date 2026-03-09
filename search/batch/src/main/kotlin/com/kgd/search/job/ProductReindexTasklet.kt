package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.client.ProductApiClient
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.tasklet.Tasklet
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class ProductReindexTasklet(
    private val productApiClient: ProductApiClient,
    private val bulkProcessor: EsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager
) : Tasklet {

    private val log = LoggerFactory.getLogger(javaClass)

    @Value("\${search.index.alias:products}")
    private lateinit var indexAlias: String

    @Value("\${search.batch.page-size:100}")
    private var pageSize: Int = 100

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus =
        runBlocking {
            val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
            log.info("Starting full reindex → {}", newIndexName)

            aliasManager.createIndex(newIndexName)

            var page = 0
            var totalPages: Int
            var totalIndexed = 0L

            do {
                val response = productApiClient.fetchPage(page, pageSize)
                totalPages = response.totalPages

                response.products.forEach { product ->
                    bulkProcessor.processDocument(
                        newIndexName,
                        ProductDocument(
                            id = product.id.toString(),
                            name = product.name,
                            price = product.price,
                            status = product.status,
                            createdAt = LocalDateTime.now()
                        )
                    )
                    totalIndexed++
                }

                log.info("Processed page {}/{}: {} products", page + 1, totalPages, response.products.size)
                page++
            } while (page < totalPages)

            // flush remaining operations before alias swap
            bulkProcessor.flush()
            Thread.sleep(1000L)

            aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
            log.info("Reindex complete: {} docs indexed, {} errors", totalIndexed, bulkProcessor.errorCount.get())

            RepeatStatus.FINISHED
        }
}
