package com.kgd.product.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.product.application.product.usecase.SyncProductStockUseCase
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class InventoryStockSyncConsumer(
    private val syncProductStockUseCase: SyncProductStockUseCase,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = [
            "inventory.stock.reserved",
            "inventory.stock.released",
            "inventory.stock.received",
        ],
        groupId = "product-stock-sync",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onInventoryStockChanged(record: ConsumerRecord<String, String>) {
        log.info("Received inventory stock event: topic={}, key={}", record.topic(), record.key())

        val node = objectMapper.readTree(record.value())
        val productId = node.get("productId").asLong()
        val availableQty = node.get("availableQty")?.asInt()

        if (availableQty != null) {
            syncProductStockUseCase.execute(
                SyncProductStockUseCase.Command(
                    productId = productId,
                    availableQty = availableQty,
                )
            )
        } else {
            log.warn("availableQty not found in event payload, skipping stock sync: productId={}", productId)
        }
    }
}
