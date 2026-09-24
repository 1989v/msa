package com.kgd.payment.infrastructure.config

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
import com.kgd.payment.infrastructure.idempotency.PaymentProcessedEventRepository
import com.kgd.payment.infrastructure.outbox.PaymentOutboxRepository
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
 * payment **전용** outbox/idempotency 배선 — 전부 payment EMF/TM(payment_db)에 묶인다.
 * 상태 변경·아웃박스 행·멱등 마킹이 한 트랜잭션. 재분리 시 payment 와 함께 이동.
 */
@Configuration
class PaymentMessagingConfig {

    @Bean
    fun paymentOutboxPort(
        repository: PaymentOutboxRepository,
        headerSource: ObjectProvider<OutboxHeaderSource>,
    ): OutboxPort = OutboxJpaAdapter(repository, headerSource = headerSource.getIfAvailable { OutboxHeaderSource.NONE })

    // 릴레이 전용 String 프로듀서 — 도메인 이벤트용 JSON 템플릿으로 보내면 payload 가 한 번 더 인용된다.
    @Bean
    fun paymentOutboxProducerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
    ): ProducerFactory<String, String> = OutboxKafka.producerFactory(bootstrapServers)

    @Bean
    fun paymentOutboxKafkaTemplate(
        @Qualifier("paymentOutboxProducerFactory") producerFactory: ProducerFactory<String, String>,
    ): KafkaTemplate<String, String> = KafkaTemplate(producerFactory)

    @Bean
    fun paymentOutboxPollingPublisher(
        repository: PaymentOutboxRepository,
        @Qualifier("paymentOutboxKafkaTemplate") kafkaTemplate: KafkaTemplate<String, String>,
        @Qualifier("paymentTransactionManager") transactionManager: PlatformTransactionManager,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        name = "payment",
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        transactionManager = transactionManager,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )

    @Bean
    fun paymentProcessedEventRepositoryAdapter(
        repository: PaymentProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)

    @Bean(name = ["paymentIdempotentTxTemplate"])
    fun paymentIdempotentTxTemplate(
        @Qualifier("paymentTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun paymentIdempotentEventHandler(
        @Qualifier("paymentProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("paymentIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "kgd.common.messaging.idempotent.cleanup", name = ["enabled"], havingValue = "true",
    )
    fun paymentIdempotentEventCleanupScheduler(
        @Qualifier("paymentProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        properties: com.kgd.common.messaging.IdempotentEventCleanupProperties,
    ): com.kgd.common.messaging.IdempotentEventCleanupScheduler =
        com.kgd.common.messaging.IdempotentEventCleanupScheduler(port, properties)
}
