package com.kgd.inventory.application.inventory.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.GetInventoryUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.domain.inventory.event.InventoryEvent
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.Reservation
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class InventoryService(
    private val inventoryRepository: InventoryRepositoryPort,
    private val reservationRepository: ReservationRepositoryPort,
    private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
) : ReserveStockUseCase, ReleaseStockUseCase, ConfirmStockUseCase, ReceiveStockUseCase, GetInventoryUseCase {

    companion object {
        private const val AGGREGATE_TYPE = "Inventory"
        private const val RESERVATION_TTL_MINUTES = 30L
    }

    override fun execute(command: ReserveStockUseCase.Command): ReserveStockUseCase.Result {
        val inventory = inventoryRepository.findByProductIdAndWarehouseId(command.productId, command.warehouseId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=${command.productId}, warehouseId=${command.warehouseId}")

        inventory.reserve(command.qty)
        val savedInventory = inventoryRepository.save(inventory)

        val reservation = Reservation.create(
            orderId = command.orderId,
            productId = command.productId,
            warehouseId = command.warehouseId,
            qty = command.qty,
            ttlMinutes = RESERVATION_TTL_MINUTES,
        )
        val savedReservation = reservationRepository.save(reservation)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")
        val reservationId = savedReservation.id
            ?: throw IllegalStateException("저장된 예약의 ID가 null입니다")

        val event = InventoryEvent.StockReserved(
            productId = command.productId,
            warehouseId = command.warehouseId,
            qty = command.qty,
            orderId = command.orderId,
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "StockReserved", objectMapper.writeValueAsString(event))

        return ReserveStockUseCase.Result(
            reservationId = reservationId,
            productId = command.productId,
            availableQty = savedInventory.getAvailableQty(),
            reservedQty = savedInventory.getReservedQty(),
        )
    }

    override fun execute(command: ReleaseStockUseCase.Command): ReleaseStockUseCase.Result {
        val reservation = reservationRepository.findByOrderIdAndProductId(command.orderId, command.productId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "예약을 찾을 수 없습니다: orderId=${command.orderId}, productId=${command.productId}")

        reservation.cancel()
        reservationRepository.save(reservation)

        val inventory = inventoryRepository.findByProductIdAndWarehouseId(reservation.productId, reservation.warehouseId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=${reservation.productId}, warehouseId=${reservation.warehouseId}")

        inventory.release(reservation.qty)
        val savedInventory = inventoryRepository.save(inventory)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

        val event = InventoryEvent.StockReleased(
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = reservation.qty,
            orderId = command.orderId,
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "StockReleased", objectMapper.writeValueAsString(event))

        return ReleaseStockUseCase.Result(
            productId = reservation.productId,
            availableQty = savedInventory.getAvailableQty(),
            reservedQty = savedInventory.getReservedQty(),
        )
    }

    override fun execute(command: ConfirmStockUseCase.Command): ConfirmStockUseCase.Result {
        val reservation = reservationRepository.findByOrderIdAndProductId(command.orderId, command.productId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "예약을 찾을 수 없습니다: orderId=${command.orderId}, productId=${command.productId}")

        reservation.confirm()
        reservationRepository.save(reservation)

        val inventory = inventoryRepository.findByProductIdAndWarehouseId(reservation.productId, reservation.warehouseId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=${reservation.productId}, warehouseId=${reservation.warehouseId}")

        inventory.confirm(reservation.qty)
        val savedInventory = inventoryRepository.save(inventory)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

        val event = InventoryEvent.StockConfirmed(
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = reservation.qty,
            orderId = command.orderId,
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "StockConfirmed", objectMapper.writeValueAsString(event))

        return ConfirmStockUseCase.Result(
            productId = reservation.productId,
            availableQty = savedInventory.getAvailableQty(),
            reservedQty = savedInventory.getReservedQty(),
        )
    }

    override fun execute(command: ReceiveStockUseCase.Command): ReceiveStockUseCase.Result {
        val inventory = inventoryRepository.findByProductIdAndWarehouseId(command.productId, command.warehouseId)
            ?: Inventory.create(productId = command.productId, warehouseId = command.warehouseId, initialQty = 0)

        inventory.receive(command.qty)
        val savedInventory = inventoryRepository.save(inventory)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

        val event = InventoryEvent.StockReceived(
            productId = command.productId,
            warehouseId = command.warehouseId,
            qty = command.qty,
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "StockReceived", objectMapper.writeValueAsString(event))

        return ReceiveStockUseCase.Result(
            productId = command.productId,
            availableQty = savedInventory.getAvailableQty(),
        )
    }

    @Transactional(readOnly = true)
    override fun execute(query: GetInventoryUseCase.Query): List<GetInventoryUseCase.Result> {
        return inventoryRepository.findAllByProductId(query.productId).map { inventory ->
            GetInventoryUseCase.Result(
                warehouseId = inventory.warehouseId,
                availableQty = inventory.getAvailableQty(),
                reservedQty = inventory.getReservedQty(),
            )
        }
    }
}
