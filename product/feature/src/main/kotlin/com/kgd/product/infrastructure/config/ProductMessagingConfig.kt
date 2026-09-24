package com.kgd.product.infrastructure.config

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
import com.kgd.product.infrastructure.idempotency.ProductProcessedEventRepository
import com.kgd.product.infrastructure.outbox.ProductOutboxRepository
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
 * 아웃박스 · 멱등 소비 배선 (전부 product EMF/TM 바인딩 — order·inventory·fulfillment 와 같은 모양).
 *
 * **ADR-0093 부터 핸들러를 직접 만든다.** 독립 앱일 때는 common 의 auto-config 가 유일한
 * port 를 보고 하나 만들어 줬는데, commerce 에 폴드되면 port 가 도메인 수만큼 생겨
 * `IdempotentEventHandler` 를 타입으로 받는 자리가 NoUniqueBeanDefinition 으로 깨진다.
 * 폴드된 도메인 전부가 쓰는 규약이다(inventory·order·fulfillment 와 같은 모양).
 */
@Configuration
class ProductMessagingConfig {

    @Bean
    fun productOutboxPort(
        repository: ProductOutboxRepository,
        headerSource: ObjectProvider<OutboxHeaderSource>,
    ): OutboxPort = OutboxJpaAdapter(repository, headerSource = headerSource.getIfAvailable { OutboxHeaderSource.NONE })

    // 릴레이 전용 String 프로듀서 — 도메인 이벤트용 JSON 템플릿으로 보내면 payload 가 한 번 더 인용된다.
    @Bean
    fun productOutboxProducerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
    ): ProducerFactory<String, String> = OutboxKafka.producerFactory(bootstrapServers)

    @Bean
    fun productOutboxKafkaTemplate(
        @Qualifier("productOutboxProducerFactory") producerFactory: ProducerFactory<String, String>,
    ): KafkaTemplate<String, String> = KafkaTemplate(producerFactory)

    @Bean
    fun productOutboxPollingPublisher(
        repository: ProductOutboxRepository,
        @Qualifier("productOutboxKafkaTemplate") kafkaTemplate: KafkaTemplate<String, String>,
        @Qualifier("productTransactionManager") transactionManager: PlatformTransactionManager,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        name = "product",
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        transactionManager = transactionManager,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )

    @Bean
    fun productProcessedEventRepositoryAdapter(
        repository: ProductProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)

    @Bean(name = ["productIdempotentTxTemplate"])
    fun productIdempotentTxTemplate(
        @Qualifier("productTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun productIdempotentEventHandler(
        @Qualifier("productProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("productIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)
}
