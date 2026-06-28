package com.kgd.order.infrastructure.config

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.outbox.OutboxJpaAdapter
import com.kgd.common.messaging.outbox.OutboxMetrics
import com.kgd.common.messaging.outbox.OutboxPollingPublisher
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.infrastructure.outbox.OrderOutboxRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * ADR-0058 — order **전용** outbox/idempotency 배선 (모두 order EMF/TM 바인딩). common 의 단일
 * 자동 바인딩(@Primary TM)에 의존하지 않아 fulfillment/inventory 와 충돌 없음(@ConditionalOnMissingBean backs off).
 * 상태변경·outbox·멱등성마킹이 order_db 한 트랜잭션. 재분리 시 order 와 함께 이동.
 */
@Configuration
class OrderMessagingConfig {

    @Bean
    fun orderOutboxPort(repository: OrderOutboxRepository): OutboxPort =
        OutboxJpaAdapter(repository)

    @Bean
    fun orderOutboxPollingPublisher(
        repository: OrderOutboxRepository,
        @Qualifier("orderKafkaTemplate") kafkaTemplate: KafkaTemplate<String, Any>,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )

    @Bean(name = ["orderIdempotentTxTemplate"])
    fun orderIdempotentTxTemplate(
        @Qualifier("orderTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun orderIdempotentEventHandler(
        @Qualifier("orderProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("orderIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)
}
