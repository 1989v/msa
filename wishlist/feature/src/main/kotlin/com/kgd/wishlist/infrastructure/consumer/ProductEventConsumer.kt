package com.kgd.wishlist.infrastructure.consumer

import tools.jackson.databind.ObjectMapper
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.domain.model.WishlistTargetType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class ProductEventConsumer(
    private val wishlistRepositoryPort: WishlistRepositoryPort,
    private val objectMapper: ObjectMapper
) {
    private val log = KotlinLogging.logger {}

    // 다형 모델(ADR-0074)에서 PRODUCT 타입으로 스코프 — 삭제된 상품의 찜만 정리한다.
    @KafkaListener(
        topics = ["product.deleted"],
        groupId = "wishlist-product-cleanup",
        containerFactory = "wishlistKafkaListenerContainerFactory",
    )
    @Transactional("wishlistTransactionManager")
    fun onProductDeleted(record: ConsumerRecord<String, String>) {
        log.info { "Received product.deleted event: key=${record.key()}" }

        val node = objectMapper.readTree(record.value())
        val productId = node.get("productId").asLong()

        wishlistRepositoryPort.deleteAllByTarget(WishlistTargetType.PRODUCT, productId.toString())
        log.info { "Deleted all wishlist items for productId=$productId" }
    }
}
