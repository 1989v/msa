package com.kgd.inventory.application.reservation.service

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRecord
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.service.InventoryService
import com.kgd.inventory.application.reservation.port.CommandAnswer
import com.kgd.inventory.application.reservation.port.CommandAnswerRepositoryPort
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import com.kgd.inventory.infrastructure.messaging.InventoryCommandConsumer
import io.mockk.mockk
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.AbstractPlatformTransactionManager
import org.springframework.transaction.support.DefaultTransactionStatus
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID

/**
 * 재고 명령 경로를 실제 서비스·도메인으로 조립한다. 저장소·아웃박스는 메모리 — 판정 근거는
 * "행이 실제로 어떻게 남았나"와 "아웃박스에 무엇이 몇 번 쌓였나"다(호출 여부만 보는 목으로는 이중 효과를 못 잡는다).
 * 멱등 원장도 진짜 [IdempotentEventHandler] 에 메모리 저장소를 물린다.
 */
class InventoryCommandHarness(vararg initial: Inventory) {

    data class Row(val eventType: String, val payload: String, val partitionKey: String?)

    val outboxRows = mutableListOf<Row>()
    private val outbox = object : OutboxPort {
        override fun save(
            aggregateType: String, aggregateId: Long, eventType: String, payload: String,
            partitionKey: String?, headers: Map<String, String>,
        ) {
            outboxRows += Row(eventType, payload, partitionKey)
        }
    }

    val inventories = FakeInventories(initial.toList())
    class FakeInventories(initial: List<Inventory>) : InventoryRepositoryPort {
        val rows = initial.associateBy { it.id!! }.toMutableMap()
        override fun save(inventory: Inventory): Inventory {
            val id = inventory.id ?: ((rows.keys.maxOrNull() ?: 0L) + 1)
            val saved = Inventory.restore(id, inventory.productId, inventory.warehouseId,
                inventory.getAvailableQty(), inventory.getReservedQty(), inventory.version + 1)
            rows[id] = saved
            return saved.copy()
        }
        override fun findByProductIdAndWarehouseId(productId: Long, warehouseId: Long) =
            rows.values.firstOrNull { it.productId == productId && it.warehouseId == warehouseId }?.copy()
        override fun findAllByProductId(productId: Long) = rows.values.filter { it.productId == productId }.map { it.copy() }
        override fun findAll() = rows.values.map { it.copy() }
        override fun lockAllByProductIds(productIds: Collection<Long>) =
            rows.values.filter { it.productId in productIds }.sortedBy { it.id }.map { it.copy() }
        private fun Inventory.copy() = Inventory.restore(id!!, productId, warehouseId, getAvailableQty(), getReservedQty(), version)
    }

    val reservations = FakeReservations()
    class FakeReservations : ReservationRepositoryPort {
        val rows = mutableListOf<Reservation>()
        override fun save(reservation: Reservation): Reservation {
            val saved = reservation.copy(id = reservation.id ?: (rows.size + 1L))
            rows.removeIf { it.id == saved.id }
            rows += saved
            return saved.copy()
        }
        override fun findByOrderIdAndProductId(orderId: Long, productId: Long) =
            rows.firstOrNull { it.orderId == orderId && it.productId == productId }?.copy()
        override fun findActiveByOrderIdAndProductId(orderId: Long, productId: Long) =
            rows.firstOrNull { it.orderId == orderId && it.productId == productId && it.getStatus() == ReservationStatus.ACTIVE }?.copy()
        override fun findAllExpired() = rows.filter { it.getStatus() == ReservationStatus.ACTIVE && it.isExpired() }.map { it.copy() }
        override fun findAllByOrderId(orderId: Long) = rows.filter { it.orderId == orderId }.sortedBy { it.id }.map { it.copy() }
    }

    val answers = FakeAnswers()
    class FakeAnswers : CommandAnswerRepositoryPort {
        val rows = mutableListOf<CommandAnswer>()
        override fun find(orderId: Long, commandKey: String) = rows.firstOrNull { it.orderId == orderId && it.commandKey == commandKey }
        override fun save(answer: CommandAnswer) {
            if (find(answer.orderId, answer.commandKey) != null) throw DataIntegrityViolationException("uk_inventory_command_answer")
            rows += answer
        }
    }

    val objectMapper = jacksonMapperBuilder().build()
    val inventoryService = InventoryService(inventories, reservations, outbox, objectMapper)
    val expiry = ReservationExpiryService(reservations, inventories, outbox, objectMapper)
    val commands = InventoryCommandService(
        reservations, inventories, answers, inventoryService, inventoryService, inventoryService, expiry, outbox, objectMapper,
    )

    private val processed = mutableSetOf<Pair<UUID, String>>()
    private val idempotent = IdempotentEventHandler(
        object : ProcessedEventRepositoryPort {
            override fun existsBy(eventId: UUID, consumerGroup: String) = (eventId to consumerGroup) in processed
            override fun mark(record: ProcessedEventRecord) {
                processed += record.eventId to record.consumerGroup
            }
            override fun deleteOlderThan(cutoff: Instant) = 0
        },
        TransactionTemplate(NoopTransactionManager),
    )
    val consumer = InventoryCommandConsumer(commands, objectMapper, idempotent, mockk<IdempotentMetrics>(relaxed = true))

    fun record(topic: String, json: String) = ConsumerRecord(topic, 0, 0L, "key", json)

    fun reserveJson(eventId: UUID, orderId: Long, vararg lines: Pair<Long, Int>) =
        """{"eventId":"$eventId","orderId":$orderId,"lines":[${lines.joinToString(",") { """{"productId":${it.first},"quantity":${it.second}}""" }}]}"""

    fun orderJson(eventId: UUID, orderId: Long) = """{"eventId":"$eventId","orderId":$orderId}"""

    fun inventory(productId: Long, warehouseId: Long = 1L) = inventories.findByProductIdAndWarehouseId(productId, warehouseId)!!

    fun events(eventType: String) = outboxRows.filter { it.eventType == eventType }

    /** 보류 기한이 지났다고 만든다 — 스케줄러는 아직 돌지 않은 상태 */
    fun lapse(orderId: Long) {
        val lapsed = reservations.rows.filter { it.orderId == orderId }
            .map { it.copy(expiredAt = LocalDateTime.now().minusMinutes(1)) }
        reservations.rows.removeIf { it.orderId == orderId }
        reservations.rows += lapsed
    }



    private object NoopTransactionManager : AbstractPlatformTransactionManager() {
        private fun readResolve(): Any = NoopTransactionManager
        override fun doGetTransaction(): Any = Any()
        override fun doBegin(transaction: Any, definition: TransactionDefinition) = Unit
        override fun doCommit(status: DefaultTransactionStatus) = Unit
        override fun doRollback(status: DefaultTransactionStatus) = Unit
    }
}

private fun Reservation.copy(id: Long? = this.id, expiredAt: LocalDateTime = this.expiredAt) =
    Reservation.restore(id!!, orderId, productId, warehouseId, qty, getStatus(), expiredAt, createdAt, getRestockedQty())
