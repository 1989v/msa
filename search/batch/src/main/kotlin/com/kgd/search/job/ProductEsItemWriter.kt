package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import org.springframework.batch.core.listener.StepExecutionListener
import org.springframework.batch.core.step.StepExecution
import org.springframework.batch.infrastructure.item.Chunk
import org.springframework.batch.infrastructure.item.ItemWriter

class ProductEsItemWriter(
    private val bulkProcessor: EsBulkDocumentProcessor
) : ItemWriter<ProductDocument>, StepExecutionListener {

    private lateinit var newIndexName: String

    override fun beforeStep(stepExecution: StepExecution) {
        newIndexName = stepExecution.jobExecution.executionContext
            .getString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY)
    }

    override fun write(chunk: Chunk<out ProductDocument>) {
        chunk.items.forEach { doc ->
            bulkProcessor.processDocument(newIndexName, doc)
        }
    }
}
