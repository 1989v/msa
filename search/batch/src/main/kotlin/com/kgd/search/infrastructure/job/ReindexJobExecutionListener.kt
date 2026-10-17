package com.kgd.search.infrastructure.job

import com.kgd.search.domain.marketstore.model.MarketStoreReindexGuard
import org.springframework.batch.core.ExitStatus
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.job.JobExecution
import org.springframework.batch.core.listener.JobExecutionListener

class ReindexJobExecutionListener(
    private val aliasManager: IndexAliasManager,
    private val bulkProcessor: OsBulkDocumentProcessor,
    private val indexAlias: String,
    private val definitionResource: String = IndexAliasManager.PRODUCTS_INDEX_DEFINITION,
    private val marketStoreGuard: Boolean = false,
) : JobExecutionListener {

    private val log = KotlinLogging.logger {}

    companion object {
        const val NEW_INDEX_NAME_KEY = "newIndexName"
    }

    override fun beforeJob(jobExecution: JobExecution) {
        val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
        aliasManager.createIndex(newIndexName, definitionResource)
        jobExecution.executionContext.putString(NEW_INDEX_NAME_KEY, newIndexName)
        log.info { "Created new index for reindex: $newIndexName" }
    }

    override fun afterJob(jobExecution: JobExecution) {
        if (jobExecution.status != BatchStatus.COMPLETED) {
            log.warn { "Job did not complete successfully (${jobExecution.status}), skipping alias swap" }
            return
        }
        val newIndexName = jobExecution.executionContext.getString(NEW_INDEX_NAME_KEY)
        bulkProcessor.flush()
        if (marketStoreGuard) {
            try {
                MarketStoreReindexGuard.check(bulkProcessor.errorCount.get(),
                    jobExecution.executionContext.getLong(MarketStoreReindexGuard.DOCUMENTS_KEY, 0))
            } catch (e: IllegalStateException) {
                jobExecution.status = BatchStatus.FAILED
                jobExecution.exitStatus = ExitStatus.FAILED
                jobExecution.addFailureException(e)
                throw e
            }
        }
        aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
        log.info { "Alias swap complete: $newIndexName → ${bulkProcessor.errorCount.get()} errors" }
    }
}
