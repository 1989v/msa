package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.order.application.claim.usecase.HandleClaimEventUseCase
import com.kgd.order.application.order.usecase.TrackDeliveryUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * 클레임·구매 확정이 받는 답과 이행 진행 (키 = orderId). 사가와 **다른 그룹**(`order-claim`)이라 같은 토픽
 * (`fulfillment.order.created` · `inventory.reservation.*` · `promotion.hold.*`)을 사가 컨슈머와 따로 받는다 —
 * 각자 자기 단계와 맞는 답만 처리하고 나머지는 무시한다.
 *
 * 페이로드 모양은 발행자를 따른다: fulfillment CancelledPayload · CancelRejectedPayload · ProgressPayload,
 * inventory ReservationEvent.Restocked · Failed, promotion HoldEventPayload, payment PaymentEventPayload.
 */
@Component
class OrderClaimConsumer(
    private val claims: HandleClaimEventUseCase,
    private val deliveries: TrackDeliveryUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("orderIdempotentEventHandler") private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["fulfillment.order.created", "fulfillment.order.cancelled", "fulfillment.order.cancel-rejected"],
        groupId = CONSUMER_GROUP,
        containerFactory = FACTORY,
    )
    fun onFulfillment(record: ConsumerRecord<String, String>) = handle(record) { node ->
        val orderId = node.required("orderId").asLong()
        when (record.topic()) {
            "fulfillment.order.created" -> claims.onFulfillmentCreated(orderId)
            "fulfillment.order.cancelled" -> claims.onFulfillmentCancelled(orderId)
            else -> claims.onFulfillmentCancelRejected(orderId)
        }
    }

    /** 출고·배송 완료 — 취소된 이행 라인은 빼고 표시한다 */
    @KafkaListener(topics = ["fulfillment.order.shipped", "fulfillment.order.delivered"], groupId = CONSUMER_GROUP, containerFactory = FACTORY)
    fun onProgress(record: ConsumerRecord<String, String>) = handle(record) { node ->
        val orderId = node.required("orderId").asLong()
        val lines = node.get("lines")
        val productIds = (0 until (lines?.size() ?: 0)).map { lines!!.get(it) }
            .filter { it.get("status")?.asString() != CANCELLED }
            .map { it.required("productId").asLong() }
        if (record.topic() == "fulfillment.order.shipped") deliveries.onShipped(orderId, productIds) else deliveries.onDelivered(orderId, productIds)
    }

    @KafkaListener(topics = ["inventory.reservation.restocked", "inventory.reservation.failed"], groupId = CONSUMER_GROUP, containerFactory = FACTORY)
    fun onInventory(record: ConsumerRecord<String, String>) = handle(record) { node ->
        val orderId = node.required("orderId").asLong()
        if (node.text("command") != COMMAND_RESTOCK) return@handle
        if (record.topic() == "inventory.reservation.restocked") {
            claims.onInventoryRestocked(orderId, node.text("restockKey"))
        } else {
            claims.onStepFailed(orderId, "inventory.restock", node.text("reason"))
        }
    }

    @KafkaListener(topics = ["promotion.hold.restored", "promotion.hold.failed"], groupId = CONSUMER_GROUP, containerFactory = FACTORY)
    fun onPromotion(record: ConsumerRecord<String, String>) = handle(record) { node ->
        val orderId = node.required("orderId").asLong()
        if (node.text("command") != COMMAND_RESTORE) return@handle
        if (record.topic() == "promotion.hold.restored") {
            claims.onPromotionRestored(orderId)
        } else {
            claims.onStepFailed(orderId, "promotion.restore", node.text("reason"))
        }
    }

    @KafkaListener(topics = ["payment.payment.refunded"], groupId = CONSUMER_GROUP, containerFactory = FACTORY)
    fun onRefunded(record: ConsumerRecord<String, String>) = handle(record) { node ->
        claims.onPaymentRefunded(node.required("orderId").asLong())
    }

    private fun handle(record: ConsumerRecord<String, String>, apply: (JsonNode) -> Unit) {
        val node = objectMapper.readTree(record.value())
        log.info { "Received ${record.topic()}: key=${record.key()}" }
        val eventId = node.text("eventId")?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            log.warn { "missing eventId topic=${record.topic()} — 클레임 단계 대조에 기대 처리한다" }
            idempotentMetrics.missingId(CONSUMER_GROUP)
            apply(node)
            return
        }
        idempotentEventHandler.process(eventId, CONSUMER_GROUP) { apply(node) }
    }

    private fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asString()

    companion object {
        const val CONSUMER_GROUP = "order-claim"
        private const val FACTORY = "orderKafkaListenerContainerFactory"
        private const val COMMAND_RESTOCK = "RESTOCK"
        private const val COMMAND_RESTORE = "RESTORE"
        private const val CANCELLED = "CANCELLED"
    }
}
