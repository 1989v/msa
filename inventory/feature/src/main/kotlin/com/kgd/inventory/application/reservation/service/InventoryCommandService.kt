package com.kgd.inventory.application.reservation.service

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase
import com.kgd.inventory.application.reservation.port.CommandAnswer
import com.kgd.inventory.application.reservation.port.CommandAnswerRepositoryPort
import com.kgd.inventory.application.reservation.usecase.ProcessInventoryCommandUseCase
import com.kgd.inventory.application.reservation.usecase.ProcessInventoryCommandUseCase.Answer
import com.kgd.inventory.domain.inventory.event.InventoryEvent
import com.kgd.inventory.domain.reservation.event.ReservationEvent
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

/**
 * 재고 명령 처리. 명령마다 inventory_db 한 트랜잭션 — 예약·재고 행, 동기화 이벤트, 답, 답 원장이 함께 커밋된다.
 * 답 원장의 (orderId, commandKey) 유니크가 동시에 온 같은 명령 둘 중 하나를 롤백시킨다.
 */
@Service
class InventoryCommandService(
    private val reservations: ReservationRepositoryPort,
    private val inventories: InventoryRepositoryPort,
    private val answers: CommandAnswerRepositoryPort,
    private val reserveOrderStock: ReserveOrderStockUseCase,
    private val confirmStockByOrder: ConfirmStockByOrderUseCase,
    private val releaseStockByOrder: ReleaseStockByOrderUseCase,
    private val expiry: ReservationExpiryService,
    @Qualifier("inventoryOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) : ProcessInventoryCommandUseCase {
    private val log = KotlinLogging.logger {}

    @Transactional("inventoryTransactionManager")
    override fun reserve(command: ProcessInventoryCommandUseCase.Reserve): Answer {
        replay(command.orderId, ReservationEvent.COMMAND_RESERVE)?.let { return it }
        // 해제 답이 먼저 나간 주문(보상이 예약 답보다 앞선 경우)에 예약 명령이 늦게 오면 거절한다 —
        // 받아 주면 아무도 풀지 않는 예약이 30분 만료까지 재고를 붙잡는다
        if (answers.find(command.orderId, ReservationEvent.COMMAND_RELEASE)?.eventType == RELEASED) {
            log.info { "해제된 주문에 늦게 온 예약 명령 — 거절한다: orderId=${command.orderId}" }
            return fail(command.orderId, ReservationEvent.COMMAND_RESERVE, ReservationEvent.REASON_RELEASED)
        }

        val result = reserveOrderStock.execute(
            ReserveOrderStockUseCase.Command(
                orderId = command.orderId,
                lines = command.lines.map { ReserveOrderStockUseCase.Line(it.productId, it.quantity) },
            ),
        )
        return when (result) {
            is ReserveOrderStockUseCase.Result.Reserved -> {
                val rows = reservations.findAllByOrderId(command.orderId).filter { it.getStatus() == ReservationStatus.ACTIVE }
                val event = ReservationEvent.Reserved(
                    orderId = command.orderId,
                    lines = rows.map { it.toLine(it.qty) },
                    expiresAt = rows.minOf { it.expiredAt },
                )
                answer(command.orderId, ReservationEvent.COMMAND_RESERVE, RESERVED, event)
            }
            // 예약 유스케이스가 failed 를 이미 발행했다 — 같은 답을 원장에만 남겨 재발행 명령에 그대로 돌려준다
            is ReserveOrderStockUseCase.Result.Failed -> {
                val event = ReservationEvent.Failed(
                    orderId = command.orderId,
                    reason = ReservationEvent.REASON_INSUFFICIENT_STOCK,
                    shortages = result.shortages.map {
                        ReservationEvent.Failed.Shortage(it.productId, it.requestedQty, it.availableQty)
                    },
                )
                record(command.orderId, ReservationEvent.COMMAND_RESERVE, FAILED, event)
                Answer(FAILED, event.reason)
            }
        }
    }

    @Transactional("inventoryTransactionManager")
    override fun confirm(orderId: Long): Answer {
        replay(orderId, ReservationEvent.COMMAND_CONFIRM)?.let { return it }
        val command = ReservationEvent.COMMAND_CONFIRM
        val rows = reservations.findAllByOrderId(orderId)
        if (rows.isEmpty()) return fail(orderId, command, ReservationEvent.REASON_NOT_RESERVED)

        // 옛 흐름 전환으로 이미 확정됐다
        if (rows.all { it.getStatus() == ReservationStatus.CONFIRMED }) {
            return answer(orderId, command, CONFIRMED, ReservationEvent.Confirmed(orderId, rows.map { it.toLine(it.qty) }))
        }

        // 한 라인이라도 만료·해제됐거나 기한이 지났으면 확정하지 않는다 — 남은 ACTIVE 도 풀고 EXPIRED 로 답한다.
        // 결제된 주문의 재고가 다른 주문에 팔렸을 수 있어 부분 확정은 의미가 없다(사가가 VOID 로 되돌린다).
        val lapsed = rows.any { it.getStatus() == ReservationStatus.EXPIRED || it.getStatus() == ReservationStatus.CANCELLED } ||
            rows.any { it.getStatus() == ReservationStatus.ACTIVE && it.isExpired() }
        if (lapsed) {
            rows.filter { it.getStatus() == ReservationStatus.ACTIVE && it.isExpired() }.forEach { expiry.expireAndRelease(it) }
            releaseStockByOrder.execute(ReleaseStockByOrderUseCase.Command(orderId))
            log.info { "확정 명령이 만료된 예약에 도착: orderId=$orderId" }
            return fail(orderId, command, ReservationEvent.REASON_EXPIRED)
        }

        val active = rows.filter { it.getStatus() == ReservationStatus.ACTIVE }
        confirmStockByOrder.execute(ConfirmStockByOrderUseCase.Command(orderId))
        val confirmed = rows.filter { it.getStatus() == ReservationStatus.CONFIRMED } + active
        return answer(orderId, command, CONFIRMED, ReservationEvent.Confirmed(orderId, confirmed.map { it.toLine(it.qty) }))
    }

    @Transactional("inventoryTransactionManager")
    override fun release(orderId: Long): Answer {
        replay(orderId, ReservationEvent.COMMAND_RELEASE)?.let { return it }
        val command = ReservationEvent.COMMAND_RELEASE
        val rows = reservations.findAllByOrderId(orderId)
        // 확정된 재고는 해제가 아니라 재입고로 되돌린다 — 여기서 풀면 출고될 재고가 다시 팔린다
        if (rows.any { it.getStatus() == ReservationStatus.CONFIRMED }) {
            return fail(orderId, command, ReservationEvent.REASON_ALREADY_CONFIRMED)
        }
        val active = rows.filter { it.getStatus() == ReservationStatus.ACTIVE }
        releaseStockByOrder.execute(ReleaseStockByOrderUseCase.Command(orderId))
        return answer(orderId, command, RELEASED, ReservationEvent.Released(orderId, active.map { it.toLine(it.qty) }))
    }

    @Transactional("inventoryTransactionManager")
    override fun restock(command: ProcessInventoryCommandUseCase.Restock): Answer {
        require(command.lines == null || !command.restockKey.isNullOrBlank()) {
            "라인을 지정한 재입고에는 restockKey 가 필요하다: orderId=${command.orderId}"
        }
        val commandKey = "${ReservationEvent.COMMAND_RESTOCK}:${command.restockKey ?: "ALL"}"
        replay(command.orderId, commandKey)?.let { return it }

        val confirmed = reservations.findAllByOrderId(command.orderId).filter { it.getStatus() == ReservationStatus.CONFIRMED }
        // 한 주문 안에서 상품은 한 창고에서 나간다(예약이 상품별로 합쳐 한 창고를 고른다)
        val plan: List<Pair<Reservation, Int>> = if (command.lines == null) {
            confirmed.filter { it.restockableQty() > 0 }.map { it to it.restockableQty() }
        } else {
            val byProduct = confirmed.associateBy { it.productId }
            val requested = command.lines.groupBy({ it.productId }, { it.quantity }).mapValues { it.value.sum() }
            val unmet = requested.filter { (productId, qty) -> qty <= 0 || (byProduct[productId]?.restockableQty() ?: 0) < qty }
            if (unmet.isNotEmpty()) {
                log.warn { "재입고 불가: orderId=${command.orderId}, restockKey=${command.restockKey}, unmet=$unmet" }
                return fail(command.orderId, commandKey, ReservationEvent.REASON_NOT_RESTOCKABLE, ReservationEvent.COMMAND_RESTOCK)
            }
            requested.map { (productId, qty) -> byProduct.getValue(productId) to qty }
        }

        val lines = plan.map { (reservation, qty) -> restockOne(reservation, qty) }
        return answer(
            command.orderId, commandKey, RESTOCKED,
            ReservationEvent.Restocked(command.orderId, command.restockKey, lines),
        )
    }

    private fun restockOne(reservation: Reservation, qty: Int): ReservationEvent.Line {
        reservation.restock(qty)
        reservations.save(reservation)
        val inventory = requireNotNull(inventories.findByProductIdAndWarehouseId(reservation.productId, reservation.warehouseId)) {
            "재고를 찾을 수 없습니다: productId=${reservation.productId}, warehouseId=${reservation.warehouseId}"
        }
        inventory.restock(qty)
        val saved = inventories.save(inventory)
        val event = InventoryEvent.StockRestocked(
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = qty,
            orderId = reservation.orderId,
            availableQty = saved.getAvailableQty(),
        )
        outbox.save("Inventory", requireNotNull(saved.id), "inventory.stock.restocked", objectMapper.writeValueAsString(event))
        return reservation.toLine(qty)
    }

    /** 이미 답한 명령이면 그 답을 그대로 다시 낸다 */
    private fun replay(orderId: Long, commandKey: String): Answer? {
        val done = answers.find(orderId, commandKey) ?: return null
        log.info { "같은 명령 재수신 — 처음 답을 다시 낸다: orderId=$orderId, command=$commandKey, answer=${done.eventType}" }
        publish(orderId, done.eventType, done.payload)
        return Answer(done.eventType, objectMapper.readTree(done.payload).get("reason")?.asText())
    }

    private fun fail(orderId: Long, commandKey: String, reason: String, command: String = commandKey): Answer =
        answer(orderId, commandKey, FAILED, ReservationEvent.Failed(orderId = orderId, reason = reason, command = command))
            .copy(reason = reason)

    private fun answer(orderId: Long, commandKey: String, eventType: String, event: ReservationEvent): Answer {
        val payload = record(orderId, commandKey, eventType, event)
        publish(orderId, eventType, payload)
        return Answer(eventType)
    }

    private fun record(orderId: Long, commandKey: String, eventType: String, event: ReservationEvent): String {
        val payload = objectMapper.writeValueAsString(event)
        answers.save(CommandAnswer(orderId, commandKey, eventType, payload))
        return payload
    }

    private fun publish(orderId: Long, eventType: String, payload: String) {
        outbox.save(
            aggregateType = "Reservation",
            aggregateId = orderId,
            eventType = eventType,
            payload = payload,
            partitionKey = orderId.toString(),
            headers = emptyMap(),
        )
    }

    private fun Reservation.toLine(quantity: Int) = ReservationEvent.Line(
        reservationId = requireNotNull(id) { "저장된 예약의 ID가 null입니다" },
        productId = productId,
        warehouseId = warehouseId,
        quantity = quantity,
    )

    companion object {
        const val RESERVED = "inventory.reservation.reserved"
        const val FAILED = "inventory.reservation.failed"
        const val CONFIRMED = "inventory.reservation.confirmed"
        const val RELEASED = "inventory.reservation.released"
        const val RESTOCKED = "inventory.reservation.restocked"
    }
}
