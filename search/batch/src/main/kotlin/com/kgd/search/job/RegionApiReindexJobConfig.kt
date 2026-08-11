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
class RegionApiReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val regionReindexTasklet: RegionApiReindexTasklet
) {
    @Bean
    fun regionApiReindexJob(regionReindexStep: Step): Job =
        JobBuilder("regionApiReindexJob", jobRepository)
            .start(regionReindexStep)
            .build()

    @Bean
    fun regionReindexStep(): Step =
        StepBuilder("regionReindexStep", jobRepository)
            .tasklet(regionReindexTasklet, transactionManager)
            .build()
}
