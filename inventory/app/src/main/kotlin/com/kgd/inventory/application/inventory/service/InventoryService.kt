package com.kgd.inventory.application.inventory.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.inventory.application.inventory.port.InventoryCachePort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.GetInventoryUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.domain.inventory.event.InventoryEvent
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class InventoryService(
    private val inventoryRepository: InventoryRepositoryPort,
    private val reservationRepository: ReservationRepositoryPort,
    private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
    @param:Autowired(required = false)
    private val cachePort: InventoryCachePort? = null,
) : ReserveStockUseCase, ReleaseStockUseCase, ConfirmStockUseCase, ReceiveStockUseCase, GetInventoryUseCase,
    ConfirmStockByOrderUseCase, ReleaseStockByOrderUseCase {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        private const val AGGREGATE_TYPE = "Inventory"
        private const val RESERVATION_TTL_MINUTES = 30L
    }

    override fun execute(command: ReserveStockUseCase.Command): ReserveStockUseCase.Result {
        // Redis fast-path: 사전 검증 (재고 부족 시 DB 접근 없이 빠르게 실패)
        cachePort?.let { cache ->
            val cacheResult = cache.reserveStock(command.productId, command.warehouseId, command.qty)
            if (cacheResult == null) {
                log.debug("Redis fast-path: 재고 부족 (productId={}, warehouseId={}, qty={})", command.productId, command.warehouseId, command.qty)
                // Redis에서 부족 판정이지만 DB가 SSOT이므로 DB로 진행 (캐시가 오래됐을 수 있음)
            }
        }

        val inventory = inventoryRepository.findByProductIdAndWarehouseId(command.productId, command.warehouseId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=${command.productId}, warehouseId=${command.warehouseId}")

        inventory.reserve(command.qty)
        val savedInventory = inventoryRepository.save(inventory)

        // Redis 캐시 동기화 (DB 결과 기준)
        syncCache(command.productId, command.warehouseId, savedInventory)

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
            availableQty = savedInventory.getAvailableQty(),
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.reserved", objectMapper.writeValueAsString(event))

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

        // Redis 캐시 동기화 (write-through)
        syncCache(reservation.productId, reservation.warehouseId, savedInventory)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

        val event = InventoryEvent.StockReleased(
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = reservation.qty,
            orderId = command.orderId,
            availableQty = savedInventory.getAvailableQty(),
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.released", objectMapper.writeValueAsString(event))

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

        // Redis 캐시 동기화 (write-through)
        syncCache(reservation.productId, reservation.warehouseId, savedInventory)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

        val event = InventoryEvent.StockConfirmed(
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = reservation.qty,
            orderId = command.orderId,
            availableQty = savedInventory.getAvailableQty(),
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.confirmed", objectMapper.writeValueAsString(event))

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

        // Redis 캐시 동기화 (write-through)
        syncCache(command.productId, command.warehouseId, savedInventory)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

        val event = InventoryEvent.StockReceived(
            productId = command.productId,
            warehouseId = command.warehouseId,
            qty = command.qty,
            availableQty = savedInventory.getAvailableQty(),
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.received", objectMapper.writeValueAsString(event))

        return ReceiveStockUseCase.Result(
            productId = command.productId,
            availableQty = savedInventory.getAvailableQty(),
        )
    }

    @Transactional(readOnly = true)
    override fun execute(query: GetInventoryUseCase.Query): List<GetInventoryUseCase.Result> {
        return inventoryRepository.findAllByProductId(query.productId).map { inventory ->
            val cached = cachePort?.getStock(inventory.productId, inventory.warehouseId)
            GetInventoryUseCase.Result(
                warehouseId = inventory.warehouseId,
                availableQty = cached?.availableQty ?: inventory.getAvailableQty(),
                reservedQty = cached?.reservedQty ?: inventory.getReservedQty(),
            )
        }
    }

    override fun execute(command: ConfirmStockByOrderUseCase.Command): List<ConfirmStockByOrderUseCase.Result> {
        val reservations = reservationRepository.findAllByOrderId(command.orderId)
            .filter { it.getStatus() == ReservationStatus.ACTIVE }

        return reservations.map { reservation ->
            reservation.confirm()
            reservationRepository.save(reservation)

            val inventory = inventoryRepository.findByProductIdAndWarehouseId(reservation.productId, reservation.warehouseId)
                ?: throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=${reservation.productId}, warehouseId=${reservation.warehouseId}")

            inventory.confirm(reservation.qty)
            val savedInventory = inventoryRepository.save(inventory)

            // Redis 캐시 동기화 (write-through)
            syncCache(reservation.productId, reservation.warehouseId, savedInventory)

            val inventoryId = savedInventory.id
                ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

            val event = InventoryEvent.StockConfirmed(
                productId = reservation.productId,
                warehouseId = reservation.warehouseId,
                qty = reservation.qty,
                orderId = command.orderId,
                availableQty = savedInventory.getAvailableQty(),
            )
            outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.confirmed", objectMapper.writeValueAsString(event))

            ConfirmStockByOrderUseCase.Result(
                productId = reservation.productId,
                availableQty = savedInventory.getAvailableQty(),
                reservedQty = savedInventory.getReservedQty(),
            )
        }
    }

    override fun execute(command: ReleaseStockByOrderUseCase.Command): List<ReleaseStockByOrderUseCase.Result> {
        val reservations = reservationRepository.findAllByOrderId(command.orderId)
            .filter { it.getStatus() == ReservationStatus.ACTIVE }

        return reservations.map { reservation ->
            reservation.cancel()
            reservationRepository.save(reservation)

            val inventory = inventoryRepository.findByProductIdAndWarehouseId(reservation.productId, reservation.warehouseId)
                ?: throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=${reservation.productId}, warehouseId=${reservation.warehouseId}")

            inventory.release(reservation.qty)
            val savedInventory = inventoryRepository.save(inventory)

            // Redis 캐시 동기화 (write-through)
            syncCache(reservation.productId, reservation.warehouseId, savedInventory)

            val inventoryId = savedInventory.id
                ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")

            val event = InventoryEvent.StockReleased(
                productId = reservation.productId,
                warehouseId = reservation.warehouseId,
                qty = reservation.qty,
                orderId = command.orderId,
                availableQty = savedInventory.getAvailableQty(),
            )
            outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.released", objectMapper.writeValueAsString(event))

            ReleaseStockByOrderUseCase.Result(
                productId = reservation.productId,
                availableQty = savedInventory.getAvailableQty(),
                reservedQty = savedInventory.getReservedQty(),
            )
        }
    }

    private fun syncCache(productId: Long, warehouseId: Long, inventory: Inventory) {
        try {
            cachePort?.setStock(productId, warehouseId, inventory.getAvailableQty(), inventory.getReservedQty())
        } catch (e: Exception) {
            log.warn("Redis 캐시 동기화 실패 (productId={}, warehouseId={}): {}", productId, warehouseId, e.message)
        }
    }
}
