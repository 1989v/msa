package com.kgd.inventory.application.inventory.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.exception.BusinessException
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.domain.inventory.exception.InsufficientStockException
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDateTime

class InventoryServiceTest : BehaviorSpec({
    val inventoryRepository = mockk<InventoryRepositoryPort>()
    val reservationRepository = mockk<ReservationRepositoryPort>()
    val outboxPort = mockk<OutboxPort>(relaxed = true)
    val objectMapper = ObjectMapper()
    val service = InventoryService(inventoryRepository, reservationRepository, outboxPort, objectMapper)

    beforeEach { clearMocks(inventoryRepository, reservationRepository, outboxPort) }

    given("재고 예약 시") {
        `when`("충분한 재고가 있으면") {
            then("예약이 성공하고 outbox 이벤트가 저장되어야 한다") {
                val inventory = Inventory.restore(1L, 100L, 1L, 50, 10, 0L)
                val savedInventory = Inventory.restore(1L, 100L, 1L, 45, 15, 1L)
                val reservation = Reservation.restore(
                    1L, 10L, 100L, 1L, 5, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )

                every { reservationRepository.findActiveByOrderIdAndProductId(10L, 100L) } returns null
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns inventory
                every { inventoryRepository.save(any()) } returns savedInventory
                every { reservationRepository.save(any()) } returns reservation

                val result = service.execute(ReserveStockUseCase.Command(10L, 100L, 1L, 5))

                result.reservationId shouldBe 1L
                result.productId shouldBe 100L
                result.availableQty shouldBe 45
                result.reservedQty shouldBe 15
                verify(exactly = 1) { outboxPort.save("Inventory", 1L, "inventory.stock.reserved", any()) }
            }
        }
        `when`("재고가 부족하면") {
            then("InsufficientStockException이 발생하고 outbox가 저장되지 않아야 한다") {
                val inventory = Inventory.restore(1L, 100L, 1L, 3, 10, 0L)

                every { reservationRepository.findActiveByOrderIdAndProductId(10L, 100L) } returns null
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns inventory

                shouldThrow<InsufficientStockException> {
                    service.execute(ReserveStockUseCase.Command(10L, 100L, 1L, 5))
                }
                verify(exactly = 0) { outboxPort.save(any(), any(), any(), any()) }
            }
        }
        `when`("재고가 존재하지 않으면") {
            then("BusinessException(NOT_FOUND)이 발생해야 한다") {
                every { reservationRepository.findActiveByOrderIdAndProductId(10L, 999L) } returns null
                every { inventoryRepository.findByProductIdAndWarehouseId(999L, 1L) } returns null

                shouldThrow<BusinessException> {
                    service.execute(ReserveStockUseCase.Command(10L, 999L, 1L, 5))
                }
                verify(exactly = 0) { outboxPort.save(any(), any(), any(), any()) }
            }
        }
        // ADR-0029 PR-8a — 자연 멱등 보강 검증
        `when`("같은 (orderId, productId) 의 ACTIVE Reservation 이 이미 존재하면") {
            then("새 reservation 을 생성하지 않고 기존 결과를 반환해야 한다 (idempotent return, 이중 차감 회피)") {
                val existingReservation = Reservation.restore(
                    99L, 10L, 100L, 1L, 5, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )
                val currentInventory = Inventory.restore(1L, 100L, 1L, 45, 5, 1L)

                every { reservationRepository.findActiveByOrderIdAndProductId(10L, 100L) } returns existingReservation
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns currentInventory

                val result = service.execute(ReserveStockUseCase.Command(10L, 100L, 1L, 5))

                result.reservationId shouldBe 99L
                result.productId shouldBe 100L
                result.availableQty shouldBe 45
                result.reservedQty shouldBe 5

                // 이중 차감 / 신규 reservation / outbox 모두 발생 안 함
                verify(exactly = 0) { inventoryRepository.save(any()) }
                verify(exactly = 0) { reservationRepository.save(any()) }
                verify(exactly = 0) { outboxPort.save(any(), any(), any(), any()) }
            }
        }
    }

    // 창고 자동 선택 (warehouseId = null) — 주문 이벤트 경로
    given("창고 미지정 재고 예약 시") {
        `when`("여러 창고에 재고가 있으면") {
            then("가용 재고가 가장 많은 창고가 자동 선택되어야 한다") {
                val warehouse1 = Inventory.restore(1L, 100L, 1L, 10, 0, 0L)
                val warehouse2 = Inventory.restore(2L, 100L, 2L, 50, 0, 0L)
                val savedInventory = Inventory.restore(2L, 100L, 2L, 45, 5, 1L)
                val reservation = Reservation.restore(
                    1L, 10L, 100L, 2L, 5, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )

                every { reservationRepository.findActiveByOrderIdAndProductId(10L, 100L) } returns null
                every { inventoryRepository.findAllByProductId(100L) } returns listOf(warehouse1, warehouse2)
                every { inventoryRepository.save(any()) } returns savedInventory
                every { reservationRepository.save(any()) } returns reservation

                val result = service.execute(ReserveStockUseCase.Command(10L, 100L, null, 5))

                result.reservationId shouldBe 1L
                result.availableQty shouldBe 45
                // warehouse2 (가용 50) 가 선택되어 차감됨
                verify(exactly = 1) {
                    inventoryRepository.save(match { it.warehouseId == 2L })
                }
                verify(exactly = 1) { outboxPort.save("Inventory", 2L, "inventory.stock.reserved", any()) }
            }
        }
        `when`("어떤 창고도 요청 수량을 충족하지 못하면") {
            then("InsufficientStockException이 발생해야 한다") {
                val warehouse1 = Inventory.restore(1L, 100L, 1L, 3, 0, 0L)
                val warehouse2 = Inventory.restore(2L, 100L, 2L, 4, 0, 0L)

                every { reservationRepository.findActiveByOrderIdAndProductId(10L, 100L) } returns null
                every { inventoryRepository.findAllByProductId(100L) } returns listOf(warehouse1, warehouse2)

                shouldThrow<InsufficientStockException> {
                    service.execute(ReserveStockUseCase.Command(10L, 100L, null, 5))
                }
                verify(exactly = 0) { outboxPort.save(any(), any(), any(), any()) }
            }
        }
        `when`("어느 창고에도 재고 row 가 없으면") {
            then("BusinessException(NOT_FOUND)이 발생해야 한다") {
                every { reservationRepository.findActiveByOrderIdAndProductId(10L, 999L) } returns null
                every { inventoryRepository.findAllByProductId(999L) } returns emptyList()

                shouldThrow<BusinessException> {
                    service.execute(ReserveStockUseCase.Command(10L, 999L, null, 5))
                }
                verify(exactly = 0) { outboxPort.save(any(), any(), any(), any()) }
            }
        }
    }

    given("재고 해제 시") {
        `when`("유효한 예약이 있으면") {
            then("예약이 취소되고 재고가 복구되어야 한다") {
                val reservation = Reservation.restore(
                    1L, 10L, 100L, 1L, 5, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )
                val inventory = Inventory.restore(1L, 100L, 1L, 45, 15, 0L)
                val savedInventory = Inventory.restore(1L, 100L, 1L, 50, 10, 1L)

                every { reservationRepository.findByOrderIdAndProductId(10L, 100L) } returns reservation
                every { reservationRepository.save(any()) } returns reservation
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns inventory
                every { inventoryRepository.save(any()) } returns savedInventory

                val result = service.execute(ReleaseStockUseCase.Command(10L, 100L))

                result.productId shouldBe 100L
                result.availableQty shouldBe 50
                result.reservedQty shouldBe 10
                verify(exactly = 1) { outboxPort.save("Inventory", 1L, "inventory.stock.released", any()) }
            }
        }
    }

    given("재고 확정 시") {
        `when`("유효한 예약이 있으면") {
            then("예약이 확정되고 예약 수량이 차감되어야 한다") {
                val reservation = Reservation.restore(
                    1L, 10L, 100L, 1L, 5, ReservationStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30), LocalDateTime.now(),
                )
                val inventory = Inventory.restore(1L, 100L, 1L, 45, 15, 0L)
                val savedInventory = Inventory.restore(1L, 100L, 1L, 45, 10, 1L)

                every { reservationRepository.findByOrderIdAndProductId(10L, 100L) } returns reservation
                every { reservationRepository.save(any()) } returns reservation
                every { inventoryRepository.findByProductIdAndWarehouseId(100L, 1L) } returns inventory
                every { inventoryRepository.save(any()) } returns savedInventory

                val result = service.execute(ConfirmStockUseCase.Command(10L, 100L))

                result.productId shouldBe 100L
                result.availableQty shouldBe 45
                result.reservedQty shouldBe 10
                verify(exactly = 1) { outboxPort.save("Inventory", 1L, "inventory.stock.confirmed", any()) }
            }
        }
    }
})
