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
class AttractionApiReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val attractionReindexTasklet: AttractionApiReindexTasklet
) {
    @Bean
    fun attractionApiReindexJob(attractionReindexStep: Step): Job =
        JobBuilder("attractionApiReindexJob", jobRepository)
            .start(attractionReindexStep)
            .build()

    @Bean
    fun attractionReindexStep(): Step =
        StepBuilder("attractionReindexStep", jobRepository)
            .tasklet(attractionReindexTasklet, transactionManager)
            .build()
}
