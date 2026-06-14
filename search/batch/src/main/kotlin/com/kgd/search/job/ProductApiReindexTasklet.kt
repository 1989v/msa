package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.client.ProductApiClient
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.tasklet.Tasklet
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class ProductApiReindexTasklet(
    private val productApiClient: ProductApiClient,
    private val bulkProcessor: OsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager
) : Tasklet {

    private val log = KotlinLogging.logger {}

    @Value("\${search.index.alias:products}")
    private lateinit var indexAlias: String

    @Value("\${search.batch.page-size:100}")
    private var pageSize: Int = 100

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus =
        runBlocking {
            val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
            log.info { "Starting full reindex (API) → $newIndexName" }

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
                            createdAt = product.createdAt
                        )
                    )
                    totalIndexed++
                }

                log.info { "Processed page ${page + 1}/$totalPages: ${response.products.size} products" }
                page++
            } while (page < totalPages)

            // flush remaining operations before alias swap (blocks until complete)
            bulkProcessor.flush()

            aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
            log.info { "Reindex complete: $totalIndexed docs indexed, ${bulkProcessor.errorCount.get()} errors" }

            RepeatStatus.FINISHED
        }
}
