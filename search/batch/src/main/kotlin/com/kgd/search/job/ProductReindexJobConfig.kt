package com.kgd.search.job

import org.springframework.batch.core.job.Job
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager

@Configuration
class ProductReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val reindexTasklet: ProductReindexTasklet
) {
    @Bean
    fun productReindexJob(reindexStep: Step): Job =
        JobBuilder("productReindexJob", jobRepository)
            .start(reindexStep)
            .build()

    @Bean
    fun reindexStep(): Step =
        StepBuilder("reindexStep", jobRepository)
            .tasklet(reindexTasklet, transactionManager)
            .build()
}
