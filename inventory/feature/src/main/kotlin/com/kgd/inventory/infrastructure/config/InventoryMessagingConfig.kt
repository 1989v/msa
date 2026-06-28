package com.kgd.inventory.infrastructure.config

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * ADR-0058 — inventory **전용** idempotency 배선 (inventory TM 바인딩).
 *
 * commerce 모놀리스에서 fulfillment 등 타 도메인이 자기 IdempotentEventHandler 를 등록하면 common
 * auto-config 의 단일 핸들러가 @ConditionalOnMissingBean 으로 backs off 한다. 따라서 inventory 도
 * 자기 핸들러를 명시 등록하여 멱등성 마킹이 inventory TM(=inventory_db) 한 트랜잭션에 묶이도록 한다.
 * 재분리 시 그대로 inventory 와 함께 이동(standalone 에선 common auto-config 와 동일 동작).
 */
@Configuration
class InventoryMessagingConfig {

    @Bean(name = ["inventoryIdempotentTxTemplate"])
    fun inventoryIdempotentTxTemplate(
        @Qualifier("inventoryTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)

    @Bean
    fun inventoryIdempotentEventHandler(
        @Qualifier("jpaProcessedEventRepositoryAdapter") port: ProcessedEventRepositoryPort,
        @Qualifier("inventoryIdempotentTxTemplate") transactionTemplate: TransactionTemplate,
        metrics: IdempotentMetrics,
    ): IdempotentEventHandler = IdempotentEventHandler(port, transactionTemplate, metrics)
}
