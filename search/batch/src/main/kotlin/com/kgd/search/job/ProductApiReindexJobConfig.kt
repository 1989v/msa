package com.kgd.search.job

import org.springframework.batch.core.job.Job
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager

@Configuration
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class ProductApiReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val reindexTasklet: ProductApiReindexTasklet
) {
    @Bean
    fun productApiReindexJob(apiReindexStep: Step): Job =
        JobBuilder("productApiReindexJob", jobRepository)
            .start(apiReindexStep)
            .build()

    @Bean
    fun apiReindexStep(): Step =
        StepBuilder("apiReindexStep", jobRepository)
            .tasklet(reindexTasklet, transactionManager)
            .build()
}
