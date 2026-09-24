package com.kgd.inventory.application.reservation.service

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.service.InventoryService
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.LocalDateTime

/**
 * 재고 수량이 바뀌는 네 경로(확정·만료·해제·입고)가 전부 `inventory.stock.*` 를 아웃박스에 남기는지 본다.
 * product 의 재고 캐시는 이 이벤트로만 따라오므로, 하나라도 빠지면 그 경로 뒤로 product 재고가 어긋난다.
 */
class ReservationStockSyncEventTest : BehaviorSpec({
    val inventoryRepository = mockk<InventoryRepositoryPort>()
    val reservationRepository = mockk<ReservationRepositoryPort>()
    val outboxPort = mockk<OutboxPort>()
    val objectMapper = jacksonMapperBuilder().build()
    val inventoryService = InventoryService(inventoryRepository, reservationRepository, outboxPort, objectMapper)
    val expiryService = ReservationExpiryService(reservationRepository, inventoryRepository, outboxPort, objectMapper)

    val eventTypes = mutableListOf<String>()

    beforeEach {
        clearMocks(inventoryRepository, reservationRepository, outboxPort)
        eventTypes.clear()
        val type = slot<String>()
        every { outboxPort.save(any(), any(), capture(type), any()) } answers { eventTypes += type.captured }
        every { outboxPort.save(any(), any(), capture(type), any(), any(), any()) } answers { eventTypes += type.captured }
        every { reservationRepository.save(any()) } answers { firstArg() }
        every { inventoryRepository.save(any()) } answers { firstArg() }
    }

    fun activeReservation(expiredAt: LocalDateTime) = Reservation.restore(
        7L, 10L, 100L, 1L, 2, ReservationStatus.ACTIVE, expiredAt, LocalDateTime.now().minusMinutes(40),
    )

    given("재고 수량이 바뀌는 경로") {
        `when`("주문 단위 확정이면") {
            then("inventory.stock.confirmed 가 남는다") {
                every { reservationRepository.findAllByOrderId(10L) } returns
                    listOf(activeReservation(LocalDateTime.now().plusMinutes(10)))
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns
                    Inventory.restore(1L, 100L, 1L, 8, 2, 0L)

                inventoryService.execute(ConfirmStockByOrderUseCase.Command(orderId = 10L))

                eventTypes shouldContain "inventory.stock.confirmed"
            }
        }
        `when`("예약이 만료되면") {
            then("inventory.reservation.expired 와 함께 inventory.stock.released 가 남는다") {
                every { reservationRepository.findAllExpired() } returns
                    listOf(activeReservation(LocalDateTime.now().minusMinutes(1)))
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns
                    Inventory.restore(1L, 100L, 1L, 8, 2, 0L)

                expiryService.execute() shouldBe 1

                eventTypes shouldContain "inventory.reservation.expired"
                eventTypes shouldContain "inventory.stock.released"
            }
        }
        `when`("주문 단위 해제면") {
            then("inventory.stock.released 가 남는다") {
                every { reservationRepository.findAllByOrderId(10L) } returns
                    listOf(activeReservation(LocalDateTime.now().plusMinutes(10)))
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns
                    Inventory.restore(1L, 100L, 1L, 8, 2, 0L)

                inventoryService.execute(ReleaseStockByOrderUseCase.Command(orderId = 10L))

                eventTypes shouldContain "inventory.stock.released"
            }
        }
        `when`("입고면") {
            then("inventory.stock.received 가 남는다") {
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns
                    Inventory.restore(1L, 100L, 1L, 8, 2, 0L)

                inventoryService.execute(ReceiveStockUseCase.Command(productId = 100L, warehouseId = 1L, qty = 5))

                eventTypes shouldContain "inventory.stock.received"
            }
        }
    }
})
