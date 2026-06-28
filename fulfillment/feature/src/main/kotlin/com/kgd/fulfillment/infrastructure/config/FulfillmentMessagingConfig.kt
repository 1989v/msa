package com.kgd.fulfillment.infrastructure.config

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.outbox.OutboxJpaAdapter
import com.kgd.common.messaging.outbox.OutboxMetrics
import com.kgd.common.messaging.outbox.OutboxPollingPublisher
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.fulfillment.infrastructure.outbox.FulfillmentOutboxRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * ADR-0058 — fulfillment **전용** outbox/idempotency 배선 (모두 fulfillment EMF/TM 에 바인딩).
 *
 * common 의 단일 OutboxPort/IdempotentEventHandler 자동 바인딩(@Primary TM)에 의존하지 않고,
 * fulfillment_db 전용으로 등록한다. 이로써 상태변경·outbox·멱등성마킹이 **fulfillment TM 한 트랜잭션**.
 * 이 빈들이 존재하면 common auto-config 는 @ConditionalOnMissingBean 으로 backs off → order 등 타
 * 도메인이 자기 전용 배선을 가져도 충돌 없음. 재분리 시 그대로 fulfillment 와 함께 이동.
 */
@Configuration
class FulfillmentMessagingConfig {

    // ─── 전용 outbox ──────────────────────────────────────────────
    @Bean
    fun fulfillmentOutboxPort(repository: FulfillmentOutboxRepository): OutboxPort =
        OutboxJpaAdapter(repository)

    @Bean
    fun fulfillmentOutboxPollingPublisher(
        repository: FulfillmentOutboxRepository,
        @Qualifier("fulfillmentKafkaTemplate") kafkaTemplate: KafkaTemplate<String, Any>,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )

    // ─── 전용 idempotency ────────────────────────────────────────
    @Bean(name = ["fulfillmentIdempotentTxTemplate"])
    fun fulfillmentIdempotentTxTemplate(
        @Qualifier("fulfillmentTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun fulfillmentIdempotentEventHandler(
        @Qualifier("fulfillmentProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("fulfillmentIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)

    // ADR-0058: 도메인별 retention cleanup (전용 port 바인딩).
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "kgd.common.messaging.idempotent.cleanup", name = ["enabled"], havingValue = "true",
    )
    fun fulfillmentIdempotentEventCleanupScheduler(
        @Qualifier("fulfillmentProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        properties: com.kgd.common.messaging.IdempotentEventCleanupProperties,
    ): com.kgd.common.messaging.IdempotentEventCleanupScheduler =
        com.kgd.common.messaging.IdempotentEventCleanupScheduler(port, properties)
}
