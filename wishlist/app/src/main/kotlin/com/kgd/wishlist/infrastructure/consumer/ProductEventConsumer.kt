package com.kgd.wishlist.infrastructure.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class ProductEventConsumer(
    private val wishlistRepositoryPort: WishlistRepositoryPort,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = ["product.deleted"],
        groupId = "wishlist-product-cleanup"
    )
    @Transactional
    fun onProductDeleted(record: ConsumerRecord<String, String>) {
        log.info("Received product.deleted event: key={}", record.key())

        val node = objectMapper.readTree(record.value())
        val productId = node.get("productId").asLong()

        wishlistRepositoryPort.deleteAllByProductId(productId)
        log.info("Deleted all wishlist items for productId={}", productId)
    }
}
