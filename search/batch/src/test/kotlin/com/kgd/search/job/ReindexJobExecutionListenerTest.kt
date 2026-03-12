package com.kgd.search.job

import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.job.JobExecution
import org.springframework.batch.core.job.JobInstance
import org.springframework.batch.core.job.parameters.JobParameters

class ReindexJobExecutionListenerTest : BehaviorSpec({
    val aliasManager = mockk<IndexAliasManager>()
    val bulkProcessor = mockk<EsBulkDocumentProcessor>()
    val listener = ReindexJobExecutionListener(aliasManager, bulkProcessor, "products")

    beforeEach { clearMocks(aliasManager, bulkProcessor) }

    fun jobExecution(status: BatchStatus = BatchStatus.COMPLETED): JobExecution {
        val instance = JobInstance(1L, "productDbReindexJob")
        return JobExecution(1L, instance, JobParameters()).also { it.status = status }
    }

    given("beforeJob 호출 시") {
        `when`("정상 실행") {
            then("타임스탬프 인덱스를 생성하고 context에 저장한다") {
                every { aliasManager.createTimestampedIndexName("products") } returns "products_20260309120000"
                every { aliasManager.createIndex("products_20260309120000") } just Runs

                val exec = jobExecution()
                listener.beforeJob(exec)

                exec.executionContext.getString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY) shouldBe "products_20260309120000"
                verify { aliasManager.createIndex("products_20260309120000") }
            }
        }
    }

    given("afterJob 호출 시") {
        `when`("Job이 COMPLETED") {
            then("flush 후 alias swap을 수행한다") {
                every { aliasManager.createTimestampedIndexName("products") } returns "products_20260309120000"
                every { aliasManager.createIndex(any()) } just Runs
                every { bulkProcessor.flush() } just Runs
                every { bulkProcessor.errorCount } returns mockk { every { get() } returns 0L }
                every { aliasManager.updateAliasAndCleanup("products", "products_20260309120000") } just Runs

                val exec = jobExecution(BatchStatus.COMPLETED)
                listener.beforeJob(exec)
                listener.afterJob(exec)

                verify { bulkProcessor.flush() }
                verify { aliasManager.updateAliasAndCleanup("products", "products_20260309120000") }
            }
        }

        `when`("Job이 FAILED") {
            then("alias swap을 수행하지 않는다") {
                val exec = jobExecution(BatchStatus.FAILED)
                exec.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "products_20260309120000")
                listener.afterJob(exec)

                verify(exactly = 0) { bulkProcessor.flush() }
                verify(exactly = 0) { aliasManager.updateAliasAndCleanup(any(), any()) }
            }
        }
    }
})
