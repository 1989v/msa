package com.kgd.search.infrastructure.job

import com.kgd.search.domain.marketstore.model.MarketStoreReindexGuard
import com.kgd.search.infrastructure.client.MarketStorePlaceClient
import com.kgd.search.infrastructure.indexing.MarketStoreDocumentConverter
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.tasklet.Tasklet
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.stereotype.Component

@Component
class MarketStoreApiReindexTasklet(
    private val client: MarketStorePlaceClient,
    private val converter: MarketStoreDocumentConverter,
    private val bulk: OsBulkDocumentProcessor,
) : Tasklet {
    private val log = KotlinLogging.logger {}
    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus {
        val context = chunkContext.stepContext.stepExecution.jobExecution.executionContext
        val index = context.getString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY)
        val ids = client.contentIds()
        check(ids.isNotEmpty()) { "No market content IDs; keeping live alias" }
        val dishes = client.dishes()
        var failed = 0L
        var indexed = 0L
        var missingRoman = 0L
        var missingCategoryEn = 0L
        ids.forEach { id ->
            val documents = runCatching { converter.convert(client.market(id, "ko"), client.market(id, "en"), dishes) }
                .getOrElse { e ->
                    failed++
                    log.error(e) { "Market fetch/conversion failed: $id" }
                    emptyList()
                }
            documents.forEach { doc ->
                bulk.processDocument(index, "${doc.contentId}:${doc.storeId}", doc)
                indexed++
                if (doc.nameRoman == null) missingRoman++
                if (doc.categoryMajorEn == null && doc.categoryMidEn == null && doc.categorySubEn == null) missingCategoryEn++
            }
        }
        MarketStoreReindexGuard.check(failed, ids.size.toLong())
        context.putLong(MarketStoreReindexGuard.DOCUMENTS_KEY, indexed)
        log.info { "Market stores: $indexed documents; $failed/${ids.size} markets failed; missing nameRoman=$missingRoman categoryEn=$missingCategoryEn" }
        return RepeatStatus.FINISHED
    }
}

