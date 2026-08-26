package com.kgd.product.infrastructure.config

import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.idempotency.JpaProcessedEventRepositoryAdapter
import com.kgd.product.infrastructure.idempotency.ProductProcessedEventRepository
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** 멱등 소비 port — 이 빈이 있어야 common 의 IdempotentEventHandler auto-config 가 켜진다. */
@Configuration
class ProductMessagingConfig {

    @Bean
    fun productProcessedEventRepositoryAdapter(
        repository: ProductProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)
}
