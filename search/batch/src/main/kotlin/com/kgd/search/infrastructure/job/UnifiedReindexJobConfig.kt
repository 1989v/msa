package com.kgd.search.infrastructure.job

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
class UnifiedReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val unifiedReindexTasklet: UnifiedReindexTasklet,
) {
    @Bean
    fun unifiedReindexJob(unifiedReindexStep: Step): Job =
        JobBuilder("unifiedReindexJob", jobRepository)
            .start(unifiedReindexStep)
            .build()

    @Bean
    fun unifiedReindexStep(): Step =
        StepBuilder("unifiedReindexStep", jobRepository)
            .tasklet(unifiedReindexTasklet, transactionManager)
            .build()
}
