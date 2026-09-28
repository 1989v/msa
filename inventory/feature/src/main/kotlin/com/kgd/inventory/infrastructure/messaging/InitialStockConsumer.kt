package com.kgd.inventory.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * `product.item.created` 의 초기 재고를 기본 출고 창고로 입고한다 — 재고 원본은 inventory 라, 상품 등록 때 입력한 수량은
 * 여기서 재고 행이 되어야 주문이 예약할 수 있다. 같은 이벤트 재전달은 멱등 원장(`inventory-initial-stock` 그룹)이 거른다.
 */
@Component
class InitialStockConsumer(
    private val receiveStock: ReceiveStockUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("inventoryIdempotentEventHandler") private val idempotent: IdempotentEventHandler,
    @Value("\${inventory.default-warehouse-id}") private val warehouseId: Long,
) {
    @KafkaListener(topics = ["product.item.created"], groupId = GROUP, containerFactory = FACTORY)
    fun onProductCreated(record: ConsumerRecord<String, String>) {
        val node = objectMapper.readTree(record.value())
        val qty = node.get("initialStock")?.takeUnless { it.isNull }?.asInt() ?: 0
        // 재고 0 으로 등록한 상품은 입고할 것이 없다 — 재고는 이후 입고 API 로 들어온다
        if (qty <= 0) return
        val eventId = UUID.fromString(requireNotNull(node.get("eventId")?.asString()) { "eventId 없는 상품 생성 이벤트" })
        val productId = requireNotNull(node.get("productId")?.asLong()) { "productId 없는 상품 생성 이벤트" }
        idempotent.process(eventId, GROUP) {
            receiveStock.execute(ReceiveStockUseCase.Command(productId = productId, warehouseId = warehouseId, qty = qty))
        }
    }

    companion object {
        const val GROUP = "inventory-initial-stock"
        private const val FACTORY = "kafkaListenerContainerFactory"
    }
}
