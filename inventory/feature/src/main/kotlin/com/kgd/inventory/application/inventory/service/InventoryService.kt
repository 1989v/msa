package com.kgd.inventory.application.inventory.service

import tools.jackson.databind.ObjectMapper
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.inventory.application.inventory.port.InventoryCachePort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.GetInventoryUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.domain.inventory.event.InventoryEvent
import com.kgd.inventory.domain.inventory.exception.InsufficientStockException
import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.inventory.service.WarehouseSelector
import com.kgd.inventory.domain.reservation.event.ReservationEvent
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class InventoryService(
    private val inventoryRepository: InventoryRepositoryPort,
    private val reservationRepository: ReservationRepositoryPort,
    @Qualifier("inventoryOutboxPort") private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
    @param:Autowired(required = false)
    private val cachePort: InventoryCachePort? = null,
    // 재고·혜택 예약이 같이 쓰는 보류 기한(스펙 SR-4) — promotion 과 같은 키
    @param:Value("\${commerce.hold-minutes:30}")
    private val holdMinutes: Long = 30L,
) : ReserveStockUseCase, ReleaseStockUseCase, ConfirmStockUseCase, ReceiveStockUseCase, GetInventoryUseCase,
    ConfirmStockByOrderUseCase, ReleaseStockByOrderUseCase, ReserveOrderStockUseCase {

    private val log = KotlinLogging.logger {}

    companion object {
        private const val AGGREGATE_TYPE = "Inventory"
    }

    @Transactional
    override fun execute(command: ReserveStockUseCase.Command): ReserveStockUseCase.Result {
        // ADR-0029 PR-8a — 자연 멱등 보강 (Option A pre-check).
        // 같은 (orderId, productId) 의 ACTIVE Reservation 이 이미 있으면 신규 차감 없이 기존 결과를 반환한다.
        // - common IdempotentEventHandler 의 race 흡수 (`DataIntegrityViolationException`) 와는 별개 이슈:
        //   helper 가 마킹 이전 단계에서 멀티 인스턴스 간 동시 INSERT 가 발생하면 두 인스턴스 모두 block 을
        //   1회 실행할 수 있다. 이 시점에 본 pre-check 가 두 번째 인스턴스를 no-op 으로 흡수해 이중 차감을 막는다.
        // - DB UNIQUE 제약 (Option B) 까지는 도입하지 않는다 — 스키마 변경 비용 + 도메인 의도 (CANCELLED/EXPIRED/
        //   CONFIRMED 가 다수 존재 가능) 를 동시에 만족시키려면 부분 인덱스 등 추가 설계가 필요하기 때문.
        reservationRepository.findActiveByOrderIdAndProductId(command.orderId, command.productId)?.let { existing ->
            log.info {
                "ReserveStockUseCase idempotent return — existing ACTIVE reservation reused: " +
                    "orderId=${command.orderId} productId=${command.productId} reservationId=${existing.id}"
            }
            val inventoryForView = inventoryRepository.findByProductIdAndWarehouseId(existing.productId, existing.warehouseId)
                ?: throw BusinessException(
                    ErrorCode.NOT_FOUND,
                    "재고를 찾을 수 없습니다: productId=${existing.productId}, warehouseId=${existing.warehouseId}",
                )
            val reservationId = existing.id
                ?: throw IllegalStateException("기존 예약의 ID 가 null 입니다: orderId=${command.orderId}, productId=${command.productId}")
            return ReserveStockUseCase.Result(
                reservationId = reservationId,
                productId = existing.productId,
                availableQty = inventoryForView.getAvailableQty(),
                reservedQty = inventoryForView.getReservedQty(),
            )
        }

        val inventory = resolveInventoryForReserve(command)
        val (reservationId, savedInventory) = reserveOn(inventory, command.orderId, command.qty)

        return ReserveStockUseCase.Result(
            reservationId = reservationId,
            productId = command.productId,
            availableQty = savedInventory.getAvailableQty(),
            reservedQty = savedInventory.getReservedQty(),
        )
    }

    /**
     * 주문 단위 예약. 모든 라인의 재고 행을 id 오름차순으로 잠근 뒤 **전부 판정하고 나서** 쓴다 —
     * 모자란 라인이 하나라도 있으면 아무것도 쓰지 않고 `inventory.reservation.failed` 만 남긴다.
     * 잠금이 커밋까지 유지되므로 판정과 차감 사이에 다른 주문이 끼어들지 못한다.
     */
    @Transactional
    override fun execute(command: ReserveOrderStockUseCase.Command): ReserveOrderStockUseCase.Result {
        // 재배달 — 이미 이 주문의 예약이 있으면(전부 아니면 전무라 있으면 전부다) 그대로 돌려준다.
        val existing = reservationRepository.findAllByOrderId(command.orderId)
            .filter { it.getStatus() == ReservationStatus.ACTIVE }
        if (existing.isNotEmpty()) {
            log.info { "Order reservation already exists, returning it: orderId=${command.orderId}" }
            return ReserveOrderStockUseCase.Result.Reserved(existing.map { it.toReservedLine() })
        }

        // 같은 상품이 여러 라인이면 합쳐서 한 창고에서 낸다 — 라인별로 고르면 합계가 한 창고를 넘을 수 있다.
        val demand = linkedMapOf<Long, Int>()
        command.lines.forEach { line ->
            require(line.qty > 0) { "예약 수량은 0보다 커야 합니다: productId=${line.productId}, qty=${line.qty}" }
            demand.merge(line.productId, line.qty, Int::plus)
        }

        val candidates = inventoryRepository.lockAllByProductIds(demand.keys).groupBy { it.productId }
        val picks = demand.map { (productId, qty) ->
            Triple(productId, qty, WarehouseSelector.select(candidates[productId].orEmpty(), qty))
        }

        val shortages = picks.filter { it.third == null }.map { (productId, qty, _) ->
            ReserveOrderStockUseCase.Shortage(
                productId = productId,
                requestedQty = qty,
                availableQty = candidates[productId].orEmpty().maxOfOrNull { it.getAvailableQty() } ?: 0,
            )
        }
        if (shortages.isNotEmpty()) {
            publishReservationFailed(command.orderId, shortages)
            return ReserveOrderStockUseCase.Result.Failed(shortages)
        }

        val reserved = picks.map { (productId, qty, inventory) ->
            val (reservationId, _) = reserveOn(requireNotNull(inventory), command.orderId, qty)
            ReserveOrderStockUseCase.ReservedLine(reservationId, productId, inventory.warehouseId, qty)
        }
        return ReserveOrderStockUseCase.Result.Reserved(reserved)
    }

    private fun publishReservationFailed(orderId: Long, shortages: List<ReserveOrderStockUseCase.Shortage>) {
        log.info { "Order reservation failed (insufficient stock): orderId=$orderId, shortages=$shortages" }
        val event = ReservationEvent.Failed(
            orderId = orderId,
            reason = ReservationEvent.REASON_INSUFFICIENT_STOCK,
            shortages = shortages.map { ReservationEvent.Failed.Shortage(it.productId, it.requestedQty, it.availableQty) },
        )
        outboxPort.save(
            aggregateType = "Reservation",
            aggregateId = orderId,
            eventType = "inventory.reservation.failed",
            payload = objectMapper.writeValueAsString(event),
            partitionKey = orderId.toString(),
            headers = emptyMap(),
        )
    }

    /** 한 재고 행에서 차감하고 예약 행과 `inventory.stock.reserved` 를 남긴다. */
    private fun reserveOn(inventory: Inventory, orderId: Long, qty: Int): Pair<Long, Inventory> {
        inventory.reserve(qty)
        val savedInventory = inventoryRepository.save(inventory)

        // Redis 캐시 동기화 (DB 결과 기준)
        syncCache(inventory.productId, inventory.warehouseId, savedInventory)

        val reservation = Reservation.create(
            orderId = orderId,
            productId = inventory.productId,
            warehouseId = inventory.warehouseId,
            qty = qty,
            ttlMinutes = holdMinutes,
        )
        val savedReservation = reservationRepository.save(reservation)

        val inventoryId = savedInventory.id
            ?: throw IllegalStateException("저장된 재고의 ID가 null입니다")
        val reservationId = savedReservation.id
            ?: throw IllegalStateException("저장된 예약의 ID가 null입니다")

        val event = InventoryEvent.StockReserved(
            productId = inventory.productId,
            warehouseId = inventory.warehouseId,
            qty = qty,
            orderId = orderId,
            availableQty = savedInventory.getAvailableQty(),
        )
        outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.reserved", objectMapper.writeValueAsString(event))
        return reservationId to savedInventory
    }

    private fun Reservation.toReservedLine() = ReserveOrderStockUseCase.ReservedLine(
        reservationId = requireNotNull(id) { "저장된 예약의 ID가 null입니다" },
        productId = productId,
        warehouseId = warehouseId,
        qty = qty,
    )

    @Transactional
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

    @Transactional
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

    @Transactional
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

    @Transactional
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

    @Transactional
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

    /**
     * 예약 대상 재고를 해석한다.
     * - 창고 명시 (`warehouseId != null`): Redis fast-path 사전 검증 후 해당 창고 재고 조회.
     * - 창고 미지정 (`warehouseId == null`): [WarehouseSelector] 정책으로 자동 선택
     *   (주문 이벤트 경로 — InventoryEventConsumer). 선택과 차감이 같은 TX 안에서 일어나
     *   선택 후 재고 변동 race 는 optimistic lock (version) 으로 방어된다.
     */
    private fun resolveInventoryForReserve(command: ReserveStockUseCase.Command): Inventory {
        val warehouseId = command.warehouseId
            ?: return selectWarehouseInventory(command.productId, command.qty)

        // Redis fast-path: 사전 검증 (재고 부족 시 DB 접근 없이 빠르게 실패)
        cachePort?.let { cache ->
            val cacheResult = cache.reserveStock(command.productId, warehouseId, command.qty)
            if (cacheResult == null) {
                log.debug { "Redis fast-path: 재고 부족 (productId=${command.productId}, warehouseId=$warehouseId, qty=${command.qty})" }
                // Redis에서 부족 판정이지만 DB가 SSOT이므로 DB로 진행 (캐시가 오래됐을 수 있음)
            }
        }

        return inventoryRepository.findByProductIdAndWarehouseId(command.productId, warehouseId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=${command.productId}, warehouseId=$warehouseId")
    }

    private fun selectWarehouseInventory(productId: Long, qty: Int): Inventory {
        val candidates = inventoryRepository.findAllByProductId(productId)
        if (candidates.isEmpty()) {
            throw BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: productId=$productId")
        }
        val selected = WarehouseSelector.select(candidates, qty)
        if (selected == null) {
            val best = candidates.maxBy { it.getAvailableQty() }
            throw InsufficientStockException(productId, best.warehouseId, qty, best.getAvailableQty())
        }
        log.info {
            "창고 자동 선택: productId=$productId, qty=$qty → warehouseId=${selected.warehouseId} " +
                "(available=${selected.getAvailableQty()}, candidates=${candidates.size})"
        }
        return selected
    }

    private fun syncCache(productId: Long, warehouseId: Long, inventory: Inventory) {
        try {
            cachePort?.setStock(productId, warehouseId, inventory.getAvailableQty(), inventory.getReservedQty())
        } catch (e: Exception) {
            log.warn(e) { "Redis 캐시 동기화 실패 (productId=$productId, warehouseId=$warehouseId)" }
        }
    }
}
