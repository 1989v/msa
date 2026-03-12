package com.kgd.search.infrastructure.messaging

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class ProductIndexingConsumer(
    private val bulkProcessor: EsBulkDocumentProcessor
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Value("\${search.index.alias:products}")
    private lateinit var indexAlias: String

    @KafkaListener(
        topics = ["product.item.created", "product.item.updated"],
        groupId = "\${kafka.consumer.group-id}",
        containerFactory = "productEventListenerContainerFactory"
    )
    fun consume(event: ProductIndexEvent) {
        log.info("Received product event: productId={}", event.productId)
        try {
            bulkProcessor.processDocument(
                indexAlias,
                ProductDocument(
                    id = event.productId.toString(),
                    name = event.name,
                    price = event.price,
                    status = event.status,
                    createdAt = event.eventTime
                )
            )
        } catch (e: Exception) {
            log.error("Failed to enqueue product: productId={}", event.productId, e)
            throw e  // Spring Kafka ExponentialBackOff retry
        }
    }
}
