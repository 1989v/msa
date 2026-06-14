package com.kgd.search.job

import org.springframework.batch.core.job.Job
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager

/**
 * ADR-0056 Part 1 — 상품 시드 적재 Job.
 * 실행: `--spring.batch.job.name=productSeedIngestJob --reindex.source=seed`
 */
@Configuration
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "seed")
class ProductSeedIngestJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val seedIngestTasklet: ProductSeedIngestTasklet
) {
    @Bean
    fun productSeedIngestJob(seedIngestStep: Step): Job =
        JobBuilder("productSeedIngestJob", jobRepository)
            .start(seedIngestStep)
            .build()

    @Bean
    fun seedIngestStep(): Step =
        StepBuilder("seedIngestStep", jobRepository)
            .tasklet(seedIngestTasklet, transactionManager)
            .build()
}
