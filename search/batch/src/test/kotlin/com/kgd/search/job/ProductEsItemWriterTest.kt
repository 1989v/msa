package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.*
import org.springframework.batch.core.job.JobExecution
import org.springframework.batch.core.job.JobInstance
import org.springframework.batch.core.job.parameters.JobParameters
import org.springframework.batch.core.step.StepExecution
import org.springframework.batch.infrastructure.item.Chunk
import java.math.BigDecimal
import java.time.LocalDateTime

class ProductEsItemWriterTest : BehaviorSpec({
    val bulkProcessor = mockk<EsBulkDocumentProcessor>()
    val writer = ProductEsItemWriter(bulkProcessor)

    beforeEach {
        clearMocks(bulkProcessor)
        val jobExec = JobExecution(1L, JobInstance(1L, "job"), JobParameters())
        jobExec.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "products_test")
        val stepExec = StepExecution("step", jobExec)
        writer.beforeStep(stepExec)
    }

    given("write 호출 시") {
        `when`("문서 2개가 포함된 Chunk") {
            then("각 문서에 대해 processDocument가 호출된다") {
                every { bulkProcessor.processDocument(any(), any()) } just Runs

                val docs = listOf(
                    ProductDocument("1", "상품A", BigDecimal("1000"), "ACTIVE", LocalDateTime.now()),
                    ProductDocument("2", "상품B", BigDecimal("2000"), "ACTIVE", LocalDateTime.now())
                )
                writer.write(Chunk(docs))

                verify(exactly = 2) { bulkProcessor.processDocument("products_test", any()) }
            }
        }
    }
})
