package com.kgd.search.infrastructure.job

import com.kgd.search.domain.marketstore.model.MarketStoreReindexGuard
import com.kgd.search.infrastructure.client.MarketStorePlaceClient
import com.kgd.search.infrastructure.indexing.MarketStoreDocumentConverter
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.job.JobExecution
import org.springframework.batch.core.job.JobInstance
import org.springframework.batch.core.job.parameters.JobParameters
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.StepContribution
import tools.jackson.databind.ObjectMapper

class MarketStoreApiReindexTaskletTest : BehaviorSpec({
    val mapper = ObjectMapper()
    given("a missing bilingual market response") {
        listOf(19, 20).forEach { attempted ->
            then("1 of $attempted missing markets respects the exact 5 percent boundary") {
                val client = mockk<MarketStorePlaceClient>()
                val bulk = mockk<OsBulkDocumentProcessor>(relaxed = true)
                val execution = JobExecution(1L, JobInstance(1L, "marketStoreApiReindexJob"), JobParameters())
                execution.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "new-index")
                val chunk = mockk<ChunkContext>()
                every { chunk.stepContext.stepExecution.jobExecution } returns execution
                every { client.contentIds() } returns (1..attempted).map { it.toString() }
                every { client.dishes() } returns mapper.readTree("[]")
                every { client.market(any(), any()) } answers {
                    val id = firstArg<String>()
                    mapper.readTree("""{"market":{"contentId":"$id","name":"시장"},"stores":[{"id":1,"name":"가게"}]}""")
                }
                every { client.market("1", "en") } throws IllegalStateException("null API data")
                val tasklet = MarketStoreApiReindexTasklet(client, MarketStoreDocumentConverter(), bulk)
                if (attempted == 19) {
                    shouldThrow<IllegalStateException> { tasklet.execute(mockk<StepContribution>(), chunk) }
                } else {
                    tasklet.execute(mockk<StepContribution>(), chunk)
                    execution.executionContext.getLong(MarketStoreReindexGuard.DOCUMENTS_KEY) shouldBe 19L
                }
                verify(exactly = attempted - 1) { bulk.processDocument("new-index", any(), any()) }
            }
        }
    }
    given("an empty source scan") {
        then("fails before indexing") {
            val client = mockk<MarketStorePlaceClient>()
            val bulk = mockk<OsBulkDocumentProcessor>(relaxed = true)
            val execution = JobExecution(1L, JobInstance(1L, "marketStoreApiReindexJob"), JobParameters())
            execution.status = BatchStatus.STARTED
            execution.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "new-index")
            val chunk = mockk<ChunkContext>()
            every { chunk.stepContext.stepExecution.jobExecution } returns execution
            every { client.contentIds() } returns emptyList()
            shouldThrow<IllegalStateException> {
                MarketStoreApiReindexTasklet(client, MarketStoreDocumentConverter(), bulk).execute(mockk<StepContribution>(), chunk)
            }
            verify(exactly = 0) { bulk.processDocument(any(), any(), any()) }
        }
    }
})
