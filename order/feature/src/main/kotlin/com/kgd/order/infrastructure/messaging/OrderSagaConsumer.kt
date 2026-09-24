package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.order.application.saga.usecase.HandleSagaEventUseCase
import com.kgd.order.application.saga.usecase.InventoryAnswer
import com.kgd.order.application.saga.usecase.InventoryAnswerType
import com.kgd.order.application.saga.usecase.PaymentOutcome
import com.kgd.order.application.saga.usecase.PaymentOutcomeType
import com.kgd.order.application.saga.usecase.PromotionAnswer
import com.kgd.order.application.saga.usecase.PromotionAnswerType
import com.kgd.order.domain.saga.model.ReservedLine
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * 사가 답·이벤트 수신 (키 = orderId). 옛 `onReservationExpired`(주문 즉시 취소)를 대체한다 —
 * `inventory.reservation.expired` 도 이제 코디네이터가 보류 만료 규칙으로 처리한다.
 *
 * 토픽 이름의 마지막 조각이 답 종류다. 페이로드 모양은 각 발행자(ReservationEvent · HoldEventPayload ·
 * PaymentEventPayload · fulfillment CreatedPayload)를 따른다. 같은 이벤트 재배달은 멱등 원장(`order-saga` 그룹)이,
 * 같은 답의 재발행은 코디네이터의 단계 대조가 거른다.
 */
@Component
class OrderSagaConsumer(
    private val saga: HandleSagaEventUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("orderIdempotentEventHandler") private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = [
            "inventory.reservation.reserved", "inventory.reservation.failed", "inventory.reservation.confirmed",
            "inventory.reservation.released", "inventory.reservation.restocked", "inventory.reservation.expired",
        ],
        groupId = CONSUMER_GROUP,
        containerFactory = FACTORY,
    )
    fun onInventory(record: ConsumerRecord<String, String>) = handle(record) { node ->
        val type = InventoryAnswerType.valueOf(kindOf(record))
        saga.onInventory(
            InventoryAnswer(
                orderId = node.required("orderId").asLong(),
                type = type,
                command = node.text("command"),
                reason = node.text("reason"),
                lines = if (type == InventoryAnswerType.EXPIRED) emptyList() else lines(node),
            ),
        )
    }

    @KafkaListener(
        topics = [
            "promotion.hold.reserved", "promotion.hold.failed", "promotion.hold.confirmed",
            "promotion.hold.cancelled", "promotion.hold.expired", "promotion.hold.restored",
        ],
        groupId = CONSUMER_GROUP,
        containerFactory = FACTORY,
    )
    fun onPromotion(record: ConsumerRecord<String, String>) = handle(record) { node ->
        saga.onPromotion(
            PromotionAnswer(
                orderId = node.required("orderId").asLong(),
                type = PromotionAnswerType.valueOf(kindOf(record)),
                command = node.text("command"),
                reason = node.text("reason"),
            ),
        )
    }

    @KafkaListener(
        topics = [
            "payment.payment.authorized", "payment.payment.failed", "payment.payment.unknown",
            "payment.payment.captured", "payment.payment.voided",
        ],
        groupId = CONSUMER_GROUP,
        containerFactory = FACTORY,
    )
    fun onPayment(record: ConsumerRecord<String, String>) = handle(record) { node ->
        saga.onPayment(
            PaymentOutcome(
                orderId = node.required("orderId").asLong(),
                type = PaymentOutcomeType.valueOf(kindOf(record)),
                reason = node.text("reason"),
            ),
        )
    }

    @KafkaListener(topics = ["fulfillment.order.created"], groupId = CONSUMER_GROUP, containerFactory = FACTORY)
    fun onFulfillmentCreated(record: ConsumerRecord<String, String>) = handle(record) { node ->
        saga.onFulfillmentCreated(node.required("orderId").asLong())
    }

    private fun handle(record: ConsumerRecord<String, String>, apply: (JsonNode) -> Unit) {
        val node = objectMapper.readTree(record.value())
        log.info { "Received ${record.topic()}: key=${record.key()}" }
        val eventId = node.text("eventId")?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            log.warn { "missing eventId topic=${record.topic()} — 사가 단계 대조에 기대 처리한다" }
            idempotentMetrics.missingId(CONSUMER_GROUP)
            apply(node)
            return
        }
        idempotentEventHandler.process(eventId, CONSUMER_GROUP) { apply(node) }
    }

    private fun lines(node: JsonNode): List<ReservedLine> {
        val lines = node.get("lines") ?: return emptyList()
        return (0 until lines.size()).map { i ->
            val it = lines.get(i)
            ReservedLine(it.required("productId").asLong(), it.required("warehouseId").asLong(), it.required("quantity").asInt())
        }
    }

    private fun kindOf(record: ConsumerRecord<String, String>) = record.topic().substringAfterLast('.').uppercase()

    private fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asString()

    companion object {
        const val CONSUMER_GROUP = "order-saga"
        private const val FACTORY = "orderKafkaListenerContainerFactory"
    }
}
