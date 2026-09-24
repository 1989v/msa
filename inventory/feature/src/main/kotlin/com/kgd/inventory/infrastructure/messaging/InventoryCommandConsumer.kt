package com.kgd.inventory.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.inventory.application.reservation.usecase.ProcessInventoryCommandUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * 사가·클레임 명령 `inventory.command.{reserve,confirm,release,restock}` (키 = orderId).
 *
 * 옛 코레오그래피 구독(`order.order.completed`·`order.order.cancelled`·`fulfillment.order.shipped`·
 * `fulfillment.order.cancelled`)을 대체한다 — 예약·확정·해제·재입고는 이제 명령으로만 일어난다.
 *
 * 업무상 실패(재고 부족·만료·이미 확정)는 유스케이스가 `inventory.reservation.failed` 로 답하고 정상 반환한다.
 * 여기서 예외가 나는 것은 페이로드가 계약을 어긴 경우뿐이고, 그것만 DLT 로 간다.
 * 멱등은 두 겹: `processed_event` 원장(같은 이벤트 재배달) + 답 원장(같은 orderId 의 새 명령에 같은 답).
 */
@Component
class InventoryCommandConsumer(
    private val commands: ProcessInventoryCommandUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("inventoryIdempotentEventHandler") private val idempotent: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(topics = [RESERVE], groupId = GROUP, containerFactory = FACTORY)
    fun onReserve(record: ConsumerRecord<String, String>) = handle(record) { c ->
        val lines = requireNotNull(c.lines) { "reserve 에 lines 가 없다" }
        require(lines.isNotEmpty()) { "reserve 의 lines 가 비었다: orderId=${c.orderId}" }
        commands.reserve(ProcessInventoryCommandUseCase.Reserve(c.orderId, lines.map { it.toLine() }))
    }

    @KafkaListener(topics = [CONFIRM], groupId = GROUP, containerFactory = FACTORY)
    fun onConfirm(record: ConsumerRecord<String, String>) = handle(record) { c -> commands.confirm(c.orderId) }

    @KafkaListener(topics = [RELEASE], groupId = GROUP, containerFactory = FACTORY)
    fun onRelease(record: ConsumerRecord<String, String>) = handle(record) { c -> commands.release(c.orderId) }

    @KafkaListener(topics = [RESTOCK], groupId = GROUP, containerFactory = FACTORY)
    fun onRestock(record: ConsumerRecord<String, String>) = handle(record) { c ->
        commands.restock(ProcessInventoryCommandUseCase.Restock(c.orderId, c.restockKey, c.lines?.map { it.toLine() }))
    }

    private fun handle(record: ConsumerRecord<String, String>, block: (InventoryCommandMessage) -> Unit) {
        val command = objectMapper.readValue(record.value(), InventoryCommandMessage::class.java)
        log.info { "Received ${record.topic()}: orderId=${command.orderId}" }
        val eventId = command.eventId?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            log.warn { "missing eventId topic=${record.topic()} — 답 원장(orderId)에 기대 처리한다" }
            idempotentMetrics.missingId(GROUP)
            block(command)
            return
        }
        idempotent.process(eventId, GROUP) { block(command) }
    }

    private fun InventoryCommandLine.toLine() = ProcessInventoryCommandUseCase.Line(productId, quantity)

    companion object {
        const val RESERVE = "inventory.command.reserve"
        const val CONFIRM = "inventory.command.confirm"
        const val RELEASE = "inventory.command.release"
        const val RESTOCK = "inventory.command.restock"

        /** ADR-0029 §6.2.1 — inventory 컨슈머의 표준 group id */
        const val GROUP = "inventory-service"
        private const val FACTORY = "kafkaListenerContainerFactory"
    }
}

/** `inventory.command.*` 페이로드. reserve 는 lines 필수, restock 은 lines 를 주면 restockKey 필수 */
data class InventoryCommandMessage(
    val eventId: String? = null,
    val orderId: Long,
    val lines: List<InventoryCommandLine>? = null,
    val restockKey: String? = null,
)

data class InventoryCommandLine(val productId: Long, val quantity: Int)
