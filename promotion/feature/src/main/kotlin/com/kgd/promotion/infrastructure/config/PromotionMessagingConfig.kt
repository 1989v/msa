package com.kgd.promotion.infrastructure.config

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.idempotency.JpaProcessedEventRepositoryAdapter
import com.kgd.common.messaging.outbox.OutboxHeaderSource
import com.kgd.common.messaging.outbox.OutboxJpaAdapter
import com.kgd.common.messaging.outbox.OutboxKafka
import com.kgd.common.messaging.outbox.OutboxMetrics
import com.kgd.common.messaging.outbox.OutboxPollingPublisher
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.promotion.infrastructure.idempotency.PromotionProcessedEventRepository
import com.kgd.promotion.infrastructure.outbox.PromotionOutboxRepository
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.ObjectMapper

/**
 * promotion **전용** outbox/idempotency 배선 — 전부 promotion EMF/TM(promotion_db)에 묶인다.
 * 상태 변경·아웃박스 행·멱등 마킹이 한 트랜잭션. 재분리 시 promotion 와 함께 이동.
 */
@Configuration
class PromotionMessagingConfig {

    @Bean
    fun promotionOutboxPort(
        repository: PromotionOutboxRepository,
        headerSource: ObjectProvider<OutboxHeaderSource>,
    ): OutboxPort = OutboxJpaAdapter(repository, headerSource = headerSource.getIfAvailable { OutboxHeaderSource.NONE })

    // 릴레이 전용 String 프로듀서 — 도메인 이벤트용 JSON 템플릿으로 보내면 payload 가 한 번 더 인용된다.
    @Bean
    fun promotionOutboxProducerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
    ): ProducerFactory<String, String> = OutboxKafka.producerFactory(bootstrapServers)

    @Bean
    fun promotionOutboxKafkaTemplate(
        @Qualifier("promotionOutboxProducerFactory") producerFactory: ProducerFactory<String, String>,
    ): KafkaTemplate<String, String> = KafkaTemplate(producerFactory)

    @Bean
    fun promotionOutboxPollingPublisher(
        repository: PromotionOutboxRepository,
        @Qualifier("promotionOutboxKafkaTemplate") kafkaTemplate: KafkaTemplate<String, String>,
        @Qualifier("promotionTransactionManager") transactionManager: PlatformTransactionManager,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        name = "promotion",
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        transactionManager = transactionManager,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )

    @Bean
    fun promotionProcessedEventRepositoryAdapter(
        repository: PromotionProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)

    @Bean(name = ["promotionIdempotentTxTemplate"])
    fun promotionIdempotentTxTemplate(
        @Qualifier("promotionTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun promotionIdempotentEventHandler(
        @Qualifier("promotionProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("promotionIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "kgd.common.messaging.idempotent.cleanup", name = ["enabled"], havingValue = "true",
    )
    fun promotionIdempotentEventCleanupScheduler(
        @Qualifier("promotionProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        properties: com.kgd.common.messaging.IdempotentEventCleanupProperties,
    ): com.kgd.common.messaging.IdempotentEventCleanupScheduler =
        com.kgd.common.messaging.IdempotentEventCleanupScheduler(port, properties)
}
