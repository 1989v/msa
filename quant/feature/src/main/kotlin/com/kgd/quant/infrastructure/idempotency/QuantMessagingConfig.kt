package com.kgd.quant.infrastructure.idempotency

import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.idempotency.JpaProcessedEventRepositoryAdapter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** 멱등 소비 port — 이 빈이 있어야 common 의 IdempotentEventHandler auto-config 가 켜진다. */
@Configuration
class QuantMessagingConfig {

    @Bean
    fun quantProcessedEventRepositoryAdapter(
        repository: QuantProcessedEventRepository,
    ): ProcessedEventRepositoryPort = JpaProcessedEventRepositoryAdapter(repository)
}
