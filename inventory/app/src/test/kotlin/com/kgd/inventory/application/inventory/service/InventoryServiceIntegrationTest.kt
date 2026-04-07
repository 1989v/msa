package com.kgd.inventory.application.inventory.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

class InventoryServiceIntegrationTest : BehaviorSpec({
    val inventoryRepository = mockk<InventoryRepositoryPort>()
    val reservationRepository = mockk<ReservationRepositoryPort>()
    val outboxPort = mockk<OutboxPort>(relaxed = true)
    val objectMapper = ObjectMapper().apply { registerModule(JavaTimeModule()) }
    val service = InventoryService(inventoryRepository, reservationRepository, outboxPort, objectMapper)

    beforeEach { clearMocks(inventoryRepository, reservationRepository, outboxPort) }

    given("재고 예약 시 Outbox 이벤트 발행 검증") {
        `when`("예약이 성공하면") {
            then("inventory.stock.reserved 이벤트 타입으로 Outbox에 저장되어야 한다") {
                val inventory = Inventory.restore(1L, 100L, 1L, 50, 10, 0L)
                val savedInventory = Inventory.restore(1L, 100L, 1L, 45, 15, 1L)
                val reservation = Reservation.restore(
                    1L, 10L, 100L, 1L, 5, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )

                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns inventory
                every { inventoryRepository.save(any()) } returns savedInventory
                every { reservationRepository.save(any()) } returns reservation

                val payloadSlot = slot<String>()
                every { outboxPort.save(any(), any(), any(), capture(payloadSlot)) } returns Unit

                service.execute(ReserveStockUseCase.Command(orderId = 10L, productId = 100L, warehouseId = 1L, qty = 5))

                verify(exactly = 1) {
                    outboxPort.save(
                        aggregateType = "Inventory",
                        aggregateId = 1L,
                        eventType = "inventory.stock.reserved",
                        payload = any(),
                    )
                }

                val savedPayload = payloadSlot.captured
                savedPayload shouldContain "\"productId\":100"
                savedPayload shouldContain "\"orderId\":10"
                savedPayload shouldContain "\"qty\":5"
                savedPayload shouldContain "\"warehouseId\":1"
            }
        }

        `when`("여러 주문의 예약이 연속으로 처리되면") {
            then("각 예약마다 별도의 Outbox 이벤트가 저장되어야 한다") {
                val inventory = Inventory.restore(1L, 200L, 1L, 100, 0, 0L)
                val savedInventory1 = Inventory.restore(1L, 200L, 1L, 97, 3, 1L)
                val savedInventory2 = Inventory.restore(1L, 200L, 1L, 92, 8, 2L)

                val reservation1 = Reservation.restore(
                    1L, 20L, 200L, 1L, 3, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )
                val reservation2 = Reservation.restore(
                    2L, 21L, 200L, 1L, 5, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )

                every { inventoryRepository.findByProductIdAndWarehouseId(200L, 1L) } returns inventory
                every { inventoryRepository.save(any()) } returnsMany listOf(savedInventory1, savedInventory2)
                every { reservationRepository.save(any()) } returnsMany listOf(reservation1, reservation2)

                service.execute(ReserveStockUseCase.Command(orderId = 20L, productId = 200L, warehouseId = 1L, qty = 3))
                service.execute(ReserveStockUseCase.Command(orderId = 21L, productId = 200L, warehouseId = 1L, qty = 5))

                verify(exactly = 2) {
                    outboxPort.save(
                        aggregateType = "Inventory",
                        aggregateId = any(),
                        eventType = "inventory.stock.reserved",
                        payload = any(),
                    )
                }
            }
        }
    }
})
