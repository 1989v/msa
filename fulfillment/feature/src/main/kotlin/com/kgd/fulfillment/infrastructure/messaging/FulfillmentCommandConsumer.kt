package com.kgd.fulfillment.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.fulfillment.application.fulfillment.usecase.ProcessFulfillmentCommandUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * 사가·클레임 명령 `fulfillment.command.{create,cancel}` (키 = orderId).
 *
 * 옛 `inventory.stock.reserved` 구독을 대체한다 — 이행은 결제·확정이 끝난 뒤 사가가 명령으로 만든다.
 * 이미 출고돼 취소할 수 없는 것은 예외가 아니라 `fulfillment.order.cancel-rejected` 답이다.
 * 예외(→ DLT)는 페이로드가 계약을 어긴 경우 — 빈 라인·이행 없는 주문·이행에 없는 라인.
 */
@Component
class FulfillmentCommandConsumer(
    private val commands: ProcessFulfillmentCommandUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("fulfillmentIdempotentEventHandler") private val idempotent: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(topics = [CREATE], groupId = GROUP, containerFactory = FACTORY)
    fun onCreate(record: ConsumerRecord<String, String>) = handle(record) { c ->
        val lines = requireNotNull(c.lines) { "create 에 lines 가 없다" }.map {
            ProcessFulfillmentCommandUseCase.CreateLine(
                productId = it.productId,
                quantity = requireNotNull(it.quantity) { "create 라인에 quantity 가 없다" },
                warehouseId = requireNotNull(it.warehouseId) { "create 라인에 warehouseId 가 없다" },
            )
        }
        commands.create(ProcessFulfillmentCommandUseCase.Create(c.orderId, lines))
    }

    @KafkaListener(topics = [CANCEL], groupId = GROUP, containerFactory = FACTORY)
    fun onCancel(record: ConsumerRecord<String, String>) = handle(record) { c ->
        commands.cancel(ProcessFulfillmentCommandUseCase.Cancel(c.orderId, c.lines?.map { it.productId }?.toSet()))
    }

    private fun handle(record: ConsumerRecord<String, String>, block: (FulfillmentCommandMessage) -> Unit) {
        val command = objectMapper.readValue(record.value(), FulfillmentCommandMessage::class.java)
        log.info { "Received ${record.topic()}: orderId=${command.orderId}" }
        val eventId = command.eventId?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            log.warn { "missing eventId topic=${record.topic()} — orderId 멱등에 기대 처리한다" }
            idempotentMetrics.missingId(GROUP)
            block(command)
            return
        }
        idempotent.process(eventId, GROUP) { block(command) }
    }

    companion object {
        const val CREATE = "fulfillment.command.create"
        const val CANCEL = "fulfillment.command.cancel"

        /** ADR-0029 §6.2.3 — fulfillment 컨슈머의 표준 group id */
        const val GROUP = "fulfillment-service"
        private const val FACTORY = "fulfillmentKafkaListenerContainerFactory"
    }
}

/** `fulfillment.command.*` 페이로드. create 라인은 productId·quantity·warehouseId, cancel 라인은 productId 만 본다 */
data class FulfillmentCommandMessage(
    val eventId: String? = null,
    val orderId: Long,
    val lines: List<FulfillmentCommandLine>? = null,
)

data class FulfillmentCommandLine(val productId: Long, val quantity: Int? = null, val warehouseId: Long? = null)
