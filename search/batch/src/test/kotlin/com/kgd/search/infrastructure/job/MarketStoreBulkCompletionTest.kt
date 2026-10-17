package com.kgd.search.infrastructure.job

import com.kgd.search.domain.marketstore.model.MarketStoreReindexGuard
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.BulkRequest
import org.opensearch.client.util.ObjectBuilder
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.job.JobExecution
import org.springframework.batch.core.job.JobInstance
import org.springframework.batch.core.job.parameters.JobParameters
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.function.Function

class MarketStoreBulkCompletionTest : BehaviorSpec({
    given("a periodic primary request that drained the queue but has not completed") {
        then("final flush joins it before evaluating the 5 percent guard") {
            val entered = CountDownLatch(1)
            val release = CountDownLatch(1)
            val finalFlushStarted = CountDownLatch(1)
            val finished = CountDownLatch(1)
            val client = mockk<OpenSearchClient>()
            every { client.bulk(any<Function<BulkRequest.Builder, ObjectBuilder<BulkRequest>>>()) } answers {
                entered.countDown()
                check(release.await(5, TimeUnit.SECONDS))
                throw IllegalStateException("blocked primary failed")
            }
            val bulk = OsBulkDocumentProcessor(client)
            bulk.processDocument("new-index", "1", mapOf("storeId" to 1))
            bulk.processDocument("new-index", "2", mapOf("storeId" to 2))
            val alias = mockk<IndexAliasManager>(relaxed = true)
            val execution = JobExecution(1L, JobInstance(1L, "marketStoreApiReindexJob"), JobParameters()).also {
                it.status = BatchStatus.COMPLETED
                it.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "new-index")
                it.executionContext.putLong(MarketStoreReindexGuard.DOCUMENTS_KEY, 20)
            }
            val pool = Executors.newFixedThreadPool(2)
            try {
                val periodic = pool.submit { bulk.flushPrimaryPeriodically() }
                entered.await(5, TimeUnit.SECONDS) shouldBe true
                val final = pool.submit<Boolean> {
                    finalFlushStarted.countDown()
                    try {
                        ReindexJobExecutionListener(alias, bulk, "market-stores", marketStoreGuard = true).afterJob(execution)
                        false
                    } catch (_: IllegalStateException) {
                        true
                    } finally { finished.countDown() }
                }
                finalFlushStarted.await(5, TimeUnit.SECONDS) shouldBe true
                finished.await(100, TimeUnit.MILLISECONDS) shouldBe false
                verify(exactly = 0) { alias.updateAliasAndCleanup(any(), any(), any()) }
                release.countDown()
                periodic.get(5, TimeUnit.SECONDS)
                final.get(5, TimeUnit.SECONDS) shouldBe true
                bulk.errorCount.get() shouldBe 2L
                execution.status shouldBe BatchStatus.FAILED
                verify(exactly = 0) { alias.updateAliasAndCleanup(any(), any(), any()) }
            } finally {
                release.countDown()
                pool.shutdownNow()
            }
        }
    }
})
