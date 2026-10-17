package com.kgd.search.infrastructure.job

import com.kgd.search.domain.marketstore.model.MarketStoreReindexGuard
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.just
import io.mockk.Runs
import io.mockk.mockk
import io.mockk.verify
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.job.JobExecution
import org.springframework.batch.core.job.JobInstance
import org.springframework.batch.core.job.parameters.JobParameters
import java.util.concurrent.atomic.AtomicLong

class MarketStoreReindexListenerTest : BehaviorSpec({
    fun execution(count: Long) = JobExecution(1L, JobInstance(1L, "marketStoreApiReindexJob"), JobParameters()).also {
        it.status = BatchStatus.COMPLETED
        it.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "market-stores-20261017-2140")
        it.executionContext.putLong(MarketStoreReindexGuard.DOCUMENTS_KEY, count)
    }
    given("market-store alias completion guard") {
        listOf(19L, 20L).forEach { count ->
            then("one failed bulk document of $count ${if (count == 20L) "swaps at exactly 5%" else "keeps old alias"}") {
                val alias = mockk<IndexAliasManager>(relaxed = true)
                val bulk = mockk<OsBulkDocumentProcessor>()
                every { bulk.flush() } just Runs
                every { bulk.errorCount } returns AtomicLong(1)
                val listener = ReindexJobExecutionListener(alias, bulk, "market-stores", "/opensearch/market-stores-index.json", true)
                val exec = execution(count)
                if (count == 19L) {
                    shouldThrow<IllegalStateException> { listener.afterJob(exec) }
                    exec.status shouldBe BatchStatus.FAILED
                    verify(exactly = 0) { alias.updateAliasAndCleanup(any(), any(), any()) }
                } else {
                    listener.afterJob(exec)
                    verify(exactly = 1) { alias.updateAliasAndCleanup("market-stores", "market-stores-20261017-2140", 2) }
                }
            }
        }
        then("failed fetch step never flushes or swaps") {
            val alias = mockk<IndexAliasManager>(relaxed = true)
            val bulk = mockk<OsBulkDocumentProcessor>(relaxed = true)
            val exec = execution(20).also { it.status = BatchStatus.FAILED }
            ReindexJobExecutionListener(alias, bulk, "market-stores", marketStoreGuard = true).afterJob(exec)
            verify(exactly = 0) { alias.updateAliasAndCleanup(any(), any(), any()) }
            verify(exactly = 0) { bulk.flush() }
        }
    }
})
