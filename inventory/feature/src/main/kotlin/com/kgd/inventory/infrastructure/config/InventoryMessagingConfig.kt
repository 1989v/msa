package com.kgd.inventory.infrastructure.config

import tools.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.idempotency.JpaProcessedEventRepositoryAdapter
import com.kgd.common.messaging.outbox.OutboxJpaAdapter
import com.kgd.common.messaging.outbox.OutboxMetrics
import com.kgd.common.messaging.outbox.OutboxPollingPublisher
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.inventory.infrastructure.idempotency.InventoryProcessedEventRepository
import com.kgd.inventory.infrastructure.outbox.InventoryOutboxRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * ADR-0058 — inventory **전용** outbox/idempotency 배선 (모두 inventory EMF/TM 에 바인딩).
 *
 * commerce 모놀리스에서 fulfillment/order 가 자기 배선을 등록하면 common auto-config 의 단일 빈은
 * @ConditionalOnMissingBean 으로 backs off 한다. 따라서 inventory 도 명시 등록하여 상태변경·outbox·
 * 멱등성 마킹이 inventory TM(=inventory_db) 한 트랜잭션에 묶이도록 한다. 재분리 시 그대로 함께 이동.
 */
@Configuration
class InventoryMessagingConfig {

    // ─── 전용 outbox ──────────────────────────────────────────────
    @Bean
    fun inventoryOutboxPort(repository: InventoryOutboxRepository): OutboxPort =
        OutboxJpaAdapter(repository)

    @Bean
    fun inventoryOutboxPollingPublisher(
        repository: InventoryOutboxRepository,
        @Qualifier("kafkaTemplate") kafkaTemplate: KafkaTemplate<String, Any>,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )

    // ─── 전용 idempotency ────────────────────────────────────────
    @Bean
    fun inventoryProcessedEventRepositoryAdapter(
        repository: InventoryProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)

    @Bean(name = ["inventoryIdempotentTxTemplate"])
    fun inventoryIdempotentTxTemplate(
        @Qualifier("inventoryTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun inventoryIdempotentEventHandler(
        @Qualifier("inventoryProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("inventoryIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)

    // ADR-0058: commerce 모놀리스에서 도메인별 retention cleanup (common 단일 스케줄러는 다중 port 로 모호 → 전용).
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "kgd.common.messaging.idempotent.cleanup", name = ["enabled"], havingValue = "true",
    )
    fun inventoryIdempotentEventCleanupScheduler(
        @Qualifier("inventoryProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        properties: com.kgd.common.messaging.IdempotentEventCleanupProperties,
    ): com.kgd.common.messaging.IdempotentEventCleanupScheduler =
        com.kgd.common.messaging.IdempotentEventCleanupScheduler(port, properties)
}
