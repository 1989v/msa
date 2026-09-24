package com.kgd.seller.infrastructure.config

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.idempotency.JpaProcessedEventRepositoryAdapter
import com.kgd.common.messaging.outbox.OutboxJpaAdapter
import com.kgd.common.messaging.outbox.OutboxKafka
import com.kgd.common.messaging.outbox.OutboxMetrics
import com.kgd.common.messaging.outbox.OutboxPollingPublisher
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.seller.infrastructure.idempotency.SellerProcessedEventRepository
import com.kgd.seller.infrastructure.outbox.SellerOutboxRepository
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
 * seller **전용** outbox/idempotency 배선 — 전부 seller EMF/TM(seller_db)에 묶인다.
 * 상태 변경·아웃박스 행·멱등 마킹이 한 트랜잭션. 재분리 시 seller 와 함께 이동.
 */
@Configuration
class SellerMessagingConfig {

    @Bean
    fun sellerOutboxPort(repository: SellerOutboxRepository): OutboxPort = OutboxJpaAdapter(repository)

    // 릴레이 전용 String 프로듀서 — 도메인 이벤트용 JSON 템플릿으로 보내면 payload 가 한 번 더 인용된다.
    @Bean
    fun sellerOutboxProducerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
    ): ProducerFactory<String, String> = OutboxKafka.producerFactory(bootstrapServers)

    @Bean
    fun sellerOutboxKafkaTemplate(
        @Qualifier("sellerOutboxProducerFactory") producerFactory: ProducerFactory<String, String>,
    ): KafkaTemplate<String, String> = KafkaTemplate(producerFactory)

    @Bean
    fun sellerOutboxPollingPublisher(
        repository: SellerOutboxRepository,
        @Qualifier("sellerOutboxKafkaTemplate") kafkaTemplate: KafkaTemplate<String, String>,
        @Qualifier("sellerTransactionManager") transactionManager: PlatformTransactionManager,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        name = "seller",
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        transactionManager = transactionManager,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )

    @Bean
    fun sellerProcessedEventRepositoryAdapter(
        repository: SellerProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)

    @Bean(name = ["sellerIdempotentTxTemplate"])
    fun sellerIdempotentTxTemplate(
        @Qualifier("sellerTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun sellerIdempotentEventHandler(
        @Qualifier("sellerProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("sellerIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "kgd.common.messaging.idempotent.cleanup", name = ["enabled"], havingValue = "true",
    )
    fun sellerIdempotentEventCleanupScheduler(
        @Qualifier("sellerProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        properties: com.kgd.common.messaging.IdempotentEventCleanupProperties,
    ): com.kgd.common.messaging.IdempotentEventCleanupScheduler =
        com.kgd.common.messaging.IdempotentEventCleanupScheduler(port, properties)
}
