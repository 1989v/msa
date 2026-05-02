package com.kgd.common.messaging

import io.micrometer.core.instrument.MeterRegistry
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * ADR-0029 — Idempotent Consumer Helper Auto-Configuration.
 *
 * ## 활성화 조건
 * - [ProcessedEventRepositoryPort] 빈이 등록된 서비스에서만 활성 (`@ConditionalOnBean`).
 * - search/analytics 처럼 자연 멱등으로 충분한 서비스는 Port 를 등록하지 않으므로 자동 비활성화.
 *
 * ## 등록 빈
 * - [IdempotentEventHandler]      — Port + TransactionTemplate 조립.
 * - [IdempotentMetrics]           — Micrometer counters.
 * - [TransactionTemplate]         — 호출자가 별도 등록한 게 없을 때만 default 등록.
 * - [IdempotentEventCleanupScheduler] — `kgd.common.messaging.idempotent.cleanup.enabled=true` 인 서비스만.
 */
@AutoConfiguration
@ConditionalOnBean(ProcessedEventRepositoryPort::class)
@EnableConfigurationProperties(IdempotentEventCleanupProperties::class)
class IdempotentEventHandlerAutoConfiguration {

    @Bean(name = ["idempotentEventTransactionTemplate"])
    @ConditionalOnMissingBean(name = ["idempotentEventTransactionTemplate"])
    fun idempotentEventTransactionTemplate(
        transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    @ConditionalOnMissingBean
    fun idempotentMetrics(meterRegistry: MeterRegistry): IdempotentMetrics =
        IdempotentMetrics(meterRegistry)

    @Bean
    @ConditionalOnMissingBean
    fun idempotentEventHandler(
        port: ProcessedEventRepositoryPort,
        @org.springframework.beans.factory.annotation.Qualifier("idempotentEventTransactionTemplate")
        transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)

    /**
     * Cleanup 스케줄러는 기본 비활성. 서비스가 명시적으로 enabled=true 켜야 동작.
     */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(
        prefix = "kgd.common.messaging.idempotent.cleanup",
        name = ["enabled"],
        havingValue = "true",
    )
    @EnableScheduling
    class CleanupSchedulerConfiguration {

        @Bean
        @ConditionalOnMissingBean
        fun idempotentEventCleanupScheduler(
            port: ProcessedEventRepositoryPort,
            properties: IdempotentEventCleanupProperties,
        ): IdempotentEventCleanupScheduler =
            IdempotentEventCleanupScheduler(port, properties)
    }
}
