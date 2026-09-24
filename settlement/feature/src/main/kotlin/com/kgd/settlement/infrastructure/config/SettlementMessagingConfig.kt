package com.kgd.settlement.infrastructure.config

import com.kgd.common.messaging.IdempotentEventCleanupProperties
import com.kgd.common.messaging.IdempotentEventCleanupScheduler
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.idempotency.JpaProcessedEventRepositoryAdapter
import com.kgd.settlement.infrastructure.idempotency.SettlementProcessedEventRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/** settlement **전용** 멱등 소비 원장 배선 — settlement EMF/TM(settlement_db)에 묶인다 */
@Configuration
class SettlementMessagingConfig {

    @Bean
    fun settlementProcessedEventRepositoryAdapter(
        repository: SettlementProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)

    @Bean(name = ["settlementIdempotentTxTemplate"])
    fun settlementIdempotentTxTemplate(
        @Qualifier("settlementTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun settlementIdempotentEventHandler(
        @Qualifier("settlementProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("settlementIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)

    @Bean
    @ConditionalOnProperty(prefix = "kgd.common.messaging.idempotent.cleanup", name = ["enabled"], havingValue = "true")
    fun settlementIdempotentEventCleanupScheduler(
        @Qualifier("settlementProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        properties: IdempotentEventCleanupProperties,
    ): IdempotentEventCleanupScheduler = IdempotentEventCleanupScheduler(port, properties)
}
