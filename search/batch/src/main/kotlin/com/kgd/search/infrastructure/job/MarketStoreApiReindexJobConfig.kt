package com.kgd.search.infrastructure.job

import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import org.springframework.batch.core.job.Job
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager

@Configuration
class MarketStoreApiReindexJobConfig(
    private val repository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val tasklet: MarketStoreApiReindexTasklet,
    private val aliasManager: IndexAliasManager,
    private val bulk: OsBulkDocumentProcessor,
) {
    @Bean
    fun marketStoreApiReindexJob(marketStoreReindexStep: Step): Job =
        JobBuilder("marketStoreApiReindexJob", repository)
            .listener(ReindexJobExecutionListener(aliasManager, bulk, "market-stores",
                "/opensearch/market-stores-index.json", true))
            .start(marketStoreReindexStep).build()

    @Bean
    fun marketStoreReindexStep(): Step = StepBuilder("marketStoreReindexStep", repository)
        .tasklet(tasklet, transactionManager).build()
}
