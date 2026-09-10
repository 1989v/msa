package com.kgd.product.infrastructure.config

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.idempotency.JpaProcessedEventRepositoryAdapter
import com.kgd.product.infrastructure.idempotency.ProductProcessedEventRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * 멱등 소비 배선.
 *
 * **ADR-0093 부터 핸들러를 직접 만든다.** 독립 앱일 때는 common 의 auto-config 가 유일한
 * port 를 보고 하나 만들어 줬는데, commerce 에 폴드되면 port 가 도메인 수만큼 생겨
 * `IdempotentEventHandler` 를 타입으로 받는 자리가 NoUniqueBeanDefinition 으로 깨진다.
 * 폴드된 도메인 전부가 쓰는 규약이다(inventory·order·fulfillment 와 같은 모양).
 */
@Configuration
class ProductMessagingConfig {

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
