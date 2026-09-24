package com.kgd.inventory.application.inventory.service

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * 한 주문의 재고 예약은 전부 되거나 하나도 안 된다.
 *
 * 저장소는 메모리 가짜로 둔다 — 판정 근거가 "행이 실제로 몇 개 남았나" 여서, 호출 여부만 보는 목으로는
 * 먼저 쓴 라인이 남는 결함을 못 잡는다.
 */
class OrderReservationTest : BehaviorSpec({

    class Row(val aggregateType: String, val aggregateId: Long, val eventType: String, val payload: String, val partitionKey: String?)

    class FakeOutbox : OutboxPort {
        val rows = mutableListOf<Row>()
        override fun save(
            aggregateType: String, aggregateId: Long, eventType: String, payload: String,
            partitionKey: String?, headers: Map<String, String>,
        ) {
            rows += Row(aggregateType, aggregateId, eventType, payload, partitionKey)
        }
    }

    class FakeInventories(vararg initial: Inventory) : InventoryRepositoryPort {
        val rows = initial.associateBy { it.id!! }.toMutableMap()
        val locked = mutableListOf<Long>()
        override fun save(inventory: Inventory): Inventory {
            val id = inventory.id ?: (rows.keys.maxOrNull() ?: 0L) + 1
            val saved = Inventory.restore(id, inventory.productId, inventory.warehouseId,
                inventory.getAvailableQty(), inventory.getReservedQty(), inventory.version + 1)
            rows[id] = saved
            return saved
        }
        override fun findByProductIdAndWarehouseId(productId: Long, warehouseId: Long) =
            rows.values.firstOrNull { it.productId == productId && it.warehouseId == warehouseId }?.copy()
        override fun findAllByProductId(productId: Long) = rows.values.filter { it.productId == productId }.map { it.copy() }
        override fun findAll() = rows.values.map { it.copy() }
        override fun lockAllByProductIds(productIds: Collection<Long>): List<Inventory> =
            rows.values.filter { it.productId in productIds }.sortedBy { it.id }
                .onEach { locked += it.id!! }.map { it.copy() }

        private fun Inventory.copy() =
            Inventory.restore(id!!, productId, warehouseId, getAvailableQty(), getReservedQty(), version)
    }

    class FakeReservations : ReservationRepositoryPort {
        val rows = mutableListOf<Reservation>()
        override fun save(reservation: Reservation): Reservation {
            val saved = Reservation.restore(
                reservation.id ?: (rows.size + 1L), reservation.orderId, reservation.productId,
                reservation.warehouseId, reservation.qty, reservation.getStatus(),
                reservation.expiredAt, reservation.createdAt,
            )
            rows.removeIf { it.id == saved.id }
            rows += saved
            return saved
        }
        override fun findByOrderIdAndProductId(orderId: Long, productId: Long) =
            rows.firstOrNull { it.orderId == orderId && it.productId == productId }
        override fun findActiveByOrderIdAndProductId(orderId: Long, productId: Long) =
            rows.firstOrNull { it.orderId == orderId && it.productId == productId && it.getStatus() == ReservationStatus.ACTIVE }
        override fun findAllExpired() = emptyList<Reservation>()
        override fun findAllActive() = rows.filter { it.getStatus() == ReservationStatus.ACTIVE }
        override fun findAllByOrderId(orderId: Long) = rows.filter { it.orderId == orderId }
    }

    val objectMapper = jacksonMapperBuilder().build()

    fun command(vararg lines: Pair<Long, Int>) = ReserveOrderStockUseCase.Command(
        orderId = 77L,
        lines = lines.map { (productId, qty) -> ReserveOrderStockUseCase.Line(productId, qty) },
    )

    given("두 라인 중 한 라인의 재고가 모자라면") {
        val inventories = FakeInventories(
            Inventory.restore(1L, 100L, 1L, 10, 0, 0L),
            Inventory.restore(2L, 200L, 1L, 1, 0, 0L),
        )
        val reservations = FakeReservations()
        val outbox = FakeOutbox()
        val service = InventoryService(inventories, reservations, outbox, objectMapper)

        val result = service.execute(command(100L to 3, 200L to 5))

        then("예약 행은 하나도 생기지 않는다") {
            result.shouldBeInstanceOf<ReserveOrderStockUseCase.Result.Failed>()
            reservations.rows.shouldBeEmpty()
        }
        then("재고 수량도 그대로다 — 앞 라인이 먼저 빠지지 않는다") {
            inventories.rows.getValue(1L).getAvailableQty() shouldBe 10
            inventories.rows.getValue(1L).getReservedQty() shouldBe 0
        }
        then("inventory.reservation.failed 한 건만 주문 id 를 키로 남는다") {
            outbox.rows.map { it.eventType } shouldBe listOf("inventory.reservation.failed")
            val row = outbox.rows.single()
            row.partitionKey shouldBe "77"
            val payload = objectMapper.readTree(row.payload)
            payload.get("orderId").asLong() shouldBe 77L
            payload.get("shortages").single().get("productId").asLong() shouldBe 200L
        }
    }

    given("상품의 재고 행이 아예 없으면") {
        val reservations = FakeReservations()
        val outbox = FakeOutbox()
        val service = InventoryService(FakeInventories(), reservations, outbox, objectMapper)

        then("예외가 아니라 실패 이벤트로 끝난다") {
            service.execute(command(300L to 1)).shouldBeInstanceOf<ReserveOrderStockUseCase.Result.Failed>()
            reservations.rows.shouldBeEmpty()
            outbox.rows.map { it.eventType } shouldBe listOf("inventory.reservation.failed")
        }
    }

    given("모든 라인의 재고가 충분하면") {
        val inventories = FakeInventories(
            Inventory.restore(2L, 200L, 1L, 10, 0, 0L),
            Inventory.restore(1L, 100L, 1L, 10, 0, 0L),
        )
        val reservations = FakeReservations()
        val outbox = FakeOutbox()
        val service = InventoryService(inventories, reservations, outbox, objectMapper)

        val result = service.execute(command(200L to 2, 100L to 3))

        then("라인마다 예약이 생기고 재고 동기화 이벤트가 남는다") {
            result.shouldBeInstanceOf<ReserveOrderStockUseCase.Result.Reserved>()
            reservations.rows shouldHaveSize 2
            inventories.rows.getValue(1L).getAvailableQty() shouldBe 7
            inventories.rows.getValue(2L).getAvailableQty() shouldBe 8
            outbox.rows.map { it.eventType } shouldBe listOf("inventory.stock.reserved", "inventory.stock.reserved")
        }
        then("같은 주문을 다시 받아도 두 번 차감하지 않는다") {
            service.execute(command(200L to 2, 100L to 3))
                .shouldBeInstanceOf<ReserveOrderStockUseCase.Result.Reserved>()
            reservations.rows shouldHaveSize 2
            inventories.rows.getValue(1L).getAvailableQty() shouldBe 7
        }
    }
})
